# The Message Feature — End to End

This explains everything about chat messages in Pulse: sending, receiving, delivery
ticks, typing, editing, deleting, loading history, and the live (real-time) parts.

Read it top to bottom once. Each section builds on the one before.

---

## 1. The big idea

A chat app needs two very different things:

1. **Live push** — when someone sends you a message, it must appear on your screen
   *now*, without you asking. The server must be able to "push" data to you.
2. **History** — when you open a chat, you need the last N messages, oldest scroll-up,
   delivery ticks, reactions, etc. This is a normal "ask and get an answer" request.

Plain HTTP (REST) can only do #2. The client asks, the server answers, the connection
closes. The server can NOT start a conversation on its own. So Pulse uses **two
channels**:

| Need | Technology | Used for |
|------|-----------|----------|
| Live push both ways | **WebSocket** (STOMP) | sending messages, ticks, typing, presence, notifications |
| Ask / answer | **REST** (normal HTTP) | loading history, unread counts, message info, edit, delete, clear chat |

So one message feature is split across **two kinds of controllers**:
- `ChatController` — WebSocket. Handles the live stuff.
- `ConversationController`, `MessageActionController`, `MessageStatusController` — REST.

Keep this split in your head. It explains why there seem to be "many controllers for
messages."

---

## 2. WebSocket basics (STOMP)

### What is a WebSocket?
A normal HTTP request is one-shot. A **WebSocket** is a connection that stays **open**.
Once open, both sides can send data at any time. That is what lets the server push a new
message to you instantly.

### What is STOMP?
A raw WebSocket just sends bytes. It has no idea what "send to user 5" or "subscribe to
typing events" means. **STOMP** is a small messaging protocol layered on top of the
WebSocket. It gives us:

- **destinations** — string addresses, like `/app/chat.send` or `/queue/messages`.
- **subscribe** — "tell me whenever something arrives at this destination."
- **send** — "deliver this payload to that destination."

Think of STOMP as a tiny post office running inside the open connection.

### The config — `WebSocketConfig.java`
This class wires up the post office.

```java
registry.addEndpoint("/ws")
        .addInterceptors(authInterceptor)
        .setHandshakeHandler(new WebSocketHandshakeHandler())
        .setAllowedOrigins(allowedOriginsArray)
        .withSockJS();
```
- `/ws` is the URL the client connects to once, to open the socket.
- `addInterceptors(authInterceptor)` — checks the JWT *before* the socket opens (section 3).
- `setHandshakeHandler(...)` — attaches the user's identity to the socket (section 3).
- `setAllowedOrigins(...)` — only these frontend URLs may connect (CORS for sockets).
- `withSockJS()` — a fallback. If a browser/network can't do raw WebSocket, SockJS
  emulates it. The client just works either way.

```java
registry.enableSimpleBroker("/topic", "/queue").setHeartbeatValue(...);
registry.setApplicationDestinationPrefixes("/app");
registry.setUserDestinationPrefix("/user");
```
Three prefixes. This is the part everyone finds confusing, so go slow:

- **`/app`** — destinations the **client sends TO**, that land in *your Java code*.
  Example: client sends to `/app/chat.send`, and that triggers your `@MessageMapping("/chat.send")`
  method. "app" = "into the application code."

- **`/topic`** — **broadcast**. Anything sent here goes to *everyone subscribed*.
  Used for presence (`/topic/presence`) — when someone goes online, everyone hears it.

- **`/queue`** — **one specific user**. Used together with `/user`.

- **`/user`** — the magic prefix for "send to ONE user only." When your code calls
  `convertAndSendToUser("5", "/queue/messages", payload)`, Spring delivers it only to
  user 5's own subscription of `/user/queue/messages`. Other users subscribed to the same
  name do NOT get user 5's copy. This is how a private message reaches only the receiver.

- **`enableSimpleBroker`** — Spring runs the message broker *in memory, inside this one
  app*. Simple and fine for one server. (If you ever run multiple server copies, you'd
  swap this for an external broker like RabbitMQ; not needed now.)

- **heartbeat** `{10000, 10000}` — every 10s each side sends a tiny "still alive" ping so
  a dead connection is noticed quickly. The `ThreadPoolTaskScheduler` is just the timer
  that fires those pings.

**Summary of the address scheme:**
- Client → server: send to `/app/<something>`.
- Server → one user: `convertAndSendToUser(userId, "/queue/<something>", payload)`.
- Server → everyone: `convertAndSend("/topic/<something>", payload)`.

---

## 3. How the WebSocket knows who you are

REST requests carry the JWT in the `Authorization` header on every call. A WebSocket
opens **once** and stays open, so we authenticate **once, at open time**. Two classes do
this.

### `WebSocketAuthInterceptor` — check the token at the handshake
Browsers can't easily set custom headers when opening a WebSocket, so the token is passed
in the URL: `/ws?token=eyJhbGc...`.

```java
public boolean beforeHandshake(...) {
    String query = request.getURI().getQuery();      // "token=eyJ..."
    if (token missing) return false;                 // reject the connection
    String token = extractToken(query);
    if (!jwtUtil.isValid(token)) return false;       // bad/expired -> reject
    Long userId = jwtUtil.extractUserId(token);
    attributes.put("userId", userId);                // stash id for the next step
    return true;                                      // allow the socket to open
}
```
Returning `false` means the socket never opens. Returning `true` lets it proceed and
leaves the `userId` in `attributes` (a small map that lives for this connection).

### `WebSocketHandshakeHandler` — attach identity to the socket
```java
protected Principal determineUser(...) {
    Long userId = (Long) attributes.get("userId");   // from the interceptor
    if (userId == null) return null;
    return () -> userId.toString();                  // Principal whose name = "5"
}
```
A `Principal` is Java's standard "who is the current user" object. Here its `name` is the
user id as a string. From now on, **every** message arriving on this socket carries this
`Principal`. That is exactly why `ChatController` methods can do:

```java
public void sendMessage(SendMessageRequest request, Principal principal) {
    Long senderId = Long.valueOf(principal.getName());   // trustworthy, set at handshake
    ...
}
```
The sender id is **not** taken from the request body (which a client could lie about). It
comes from the authenticated `Principal`. This is the WebSocket version of "who are you."

> REST side equivalent: `SecurityUtil.currentUserId()` reads the same kind of identity out
> of Spring Security's context (set by the JWT filter). Same idea, different channel.

---

## 4. The data model (the tables)

Five tables matter for messages.

### `messages` — one row per message (`Message.java`)
```
id              auto number, primary key
conversationId  string, which conversation this belongs to (see section 5)
conversationType DIRECT or GROUP   (enum stored as text)
sender          FK -> users        (@ManyToOne: many messages, one sender)
type            TEXT/IMAGE/AUDIO/VIDEO/FILE
content         the text (nullable; null for pure media or after delete)
mediaUrl        storage key of attached media (nullable)
replyTo         FK -> messages     (self-link: the message this one replies to; nullable)
replyToStatusId id of a Status this message replies to (nullable)
edited          boolean
deleted         boolean (true = "deleted for everyone")
createdAt       set once at insert
updatedAt       auto-updated on change
```
Index `idx_convo_time` on `(conversation_id, created_at)` — because the #1 query is
"give me the latest messages in this conversation, newest first." The index makes that
fast.

Note `replyTo` is a `@ManyToOne` pointing back to `Message` itself — a message can quote
another message in the same conversation.

### `message_recipient_status` — delivery state, **per recipient** (`MessageRecipientStatus.java`)
This is the key design choice. The tick state (sent/delivered/read) is **not** stored on
the message. It's stored once **per (message, recipient)** pair.

```
id
message    FK -> messages
recipient  FK -> users
status     SENT / DELIVERED / READ
deliveredAt, readAt  timestamps
unique (message_id, user_id)   -> one row per recipient per message
```
Why per-recipient? In a group of 5, the same message is "read" by some and only
"delivered" to others. You need per-person state. For a direct message there's just one
such row (the receiver). The message's *overall* tick is then **computed** from these rows
(section 8).

### `deleted_messages` — "delete for me" (`DeletedMessage.java`)
One row = "user X hid message Y from their own view." Unique `(message_id, user_id)`. The
message still exists for everyone else.

### `cleared_conversations` — "clear chat" (`ClearedConversation.java`)
One row per `(user, conversationId)` with a `clearedAt` timestamp. Means "hide everything
in this conversation up to this time, for this user only." Newer messages still show.

### Enums
- `ConversationType`: DIRECT, GROUP
- `MessageType`: TEXT, IMAGE, AUDIO, VIDEO, FILE
- `MessageStatus`: SENT, DELIVERED, READ

All stored as **text** (`@Enumerated(EnumType.STRING)`) so the DB shows `"READ"`, not a
fragile number.

---

## 5. Conversation IDs — `ConversationUtil.java`

Every message belongs to a conversation, identified by a string. Two formats:

- Direct: `dm:<smallerUserId>:<largerUserId>`  e.g. users 7 and 3 → `dm:3:7`
- Group:  `group:<groupId>`                    e.g. group 12 → `group:12`

The direct id **always sorts the two ids** (`min` then `max`). This is important: it means
the id is the **same no matter who sends**. User 7 messaging 3, or 3 messaging 7, both
produce `dm:3:7`. One stable id for the pair.

Helper methods:
- `dmConversationId(a, b)` / `groupConversationId(id)` — build an id.
- `isDirect(id)` / `isGroup(id)` — check the prefix.
- `dmParticipants(id)` → the two user ids back out of a `dm:` string.
- `groupIdFrom(id)` → the group id back out of a `group:` string.

This tiny utility is used everywhere (sending, typing, delete broadcast, history) so the
id format lives in exactly one place.

---

## 6. FLOW: sending a direct message (the main flow)

Client action: user types "hi" to user 3 and hits send. The frontend sends a STOMP
message to `/app/chat.send` with body `{ receiverId: 3, content: "hi", messageType: "TEXT" }`.

### Step A — controller (`ChatController.sendMessage`)
```java
@MessageMapping("/chat.send")
public void sendMessage(SendMessageRequest request, Principal principal) {
    Long senderId = Long.valueOf(principal.getName());   // who I am (from handshake)
    chatService.sendDirectMessage(senderId, request);
}
```
`@MessageMapping("/chat.send")` is the WebSocket version of `@PostMapping`. It maps the
destination `/app/chat.send` to this method. Sender id comes from the `Principal`, not the
body. Then it hands off to the service.

### Step B — service (`ChatService.sendDirectMessage`), marked `@Transactional`
`@Transactional` = everything in this method is one DB transaction. If anything throws,
all DB writes roll back together (no half-saved message). More in section 13.

In order:

1. **Validate the request**
   - `receiverId` must be present.
   - `validateContent(...)`: if it's a TEXT message, `content` must be non-empty. If it's
     media, `mediaUrl` must be present. (You can't send an empty text or a media message
     with no file.)

2. **Load both users** (`findUser`) — sender and receiver must exist, else 404. You can't
   message yourself (400).

3. **Build the conversation id** — `dmConversationId(sender, receiver)` → `dm:3:7`.

4. **Build and save the `Message`**
   ```java
   Message message = new Message();
   message.setConversationId(conversationId);
   message.setConversationType(DIRECT);
   message.setSender(sender);
   message.setType(parseMessageType(...));   // defaults to TEXT if unknown
   message.setContent(...); message.setMediaUrl(...);
   message.setReplyTo(resolveReplyTo(...));  // if replying, load+validate the original
   Message saved = messageRepository.save(message);   // INSERT, gets an id
   ```
   `resolveReplyTo` (if `replyToId` given) loads the original message and checks it's in
   the **same conversation** — you can't reply to a message from another chat.

5. **Decide delivery vs block**
   ```java
   boolean blocked = blockService.isBlockedBetween(sender, receiver);
   if (!blocked) messageStatusService.createRecipientStatuses(saved, List.of(receiverId));
   ```
   If the two users have blocked each other, we **still save** the message (so the sender
   sees their own message normally) but we create **no recipient-status row** and we do
   **not** deliver it. The receiver never learns about it. If not blocked, we create the
   per-recipient status row (this also decides SENT vs DELIVERED — section 8).

6. **Build the response DTO** (`toResponse`) — `ChatMessageResponse`. This includes id,
   conversationId, senderId, content, createdAt, the computed status, type, a presigned
   media URL, reply info, etc. (Presigned URL = a temporary direct link to the media file;
   covered in the media feature.)

7. **Push it over the socket**
   ```java
   if (!blocked) {
       sendTo(receiver.getId(), response);            // -> receiver's screen
       notificationService.sendNotification(...);     // -> receiver's unread badge/toast
   }
   sendTo(sender.getId(), response);                  // -> sender's OTHER devices + echo
   ```
   `sendTo` is `convertAndSendToUser(userId, "/queue/messages", response)`. So the receiver
   gets the live message at `/user/queue/messages`. The sender also gets a copy — this is
   how the message appears in the sender's own chat window and stays in sync across their
   devices.

**Picture:**
```
phone(7) --STOMP /app/chat.send--> ChatController --> ChatService
   save Message  ->  create recipient-status row  ->  build response
   convertAndSendToUser(3, /queue/messages, resp)   ==> receiver(3) sees it live
   convertAndSendToUser(7, /queue/messages, resp)   ==> sender(7) sees it in their chat
   sendNotification(3, ...)                          ==> receiver(3) unread badge
```

---

## 7. FLOW: sending a group message (`sendGroupMessage`)

Same shape, with group rules. Body goes to `/app/group.send` with `{ groupId, content, ... }`.

Differences from direct:
1. The sender **must be a member** of the group, else 403
   (`groupMemberRepository.existsByGroupIdAndUserId`).
2. Conversation id is `group:<groupId>`.
3. Recipients = **all members except the sender** (`recipientIdsExcludingSender`). We
   create a recipient-status row for each of them.
4. **Delivery respects blocks per member** (`deliverGroupMessage`): for each member, if
   that member has blocked the sender, skip them; everyone else gets the live push.
5. A notification is sent to each recipient, using the sender's group name.

So a group message = "fan out the same response to every member, minus the sender, minus
anyone who blocked you."

---

## 8. FLOW: delivery state — the SENT / DELIVERED / READ ticks

This is the trickiest part. Managed by `MessageStatusService`.

### The model again
Each recipient has their own `MessageRecipientStatus` row for a message. The message's
**overall** status is computed by combining all its rows (`aggregate`):

```
total   = number of recipient rows
delivered = rows that are DELIVERED or READ
read    = rows that are READ

if total == 0          -> SENT      (no one to deliver to, e.g. blocked)
if read == total       -> READ      (everyone read it -> blue ticks)
if delivered == total  -> DELIVERED (everyone got it -> double grey ticks)
else                   -> SENT      (single tick)
```
So a group message shows READ only when *all* members have read it. (Per-person detail is
available via the "message info" endpoint, section 11.)

### When a row is first created (`createRecipientStatuses`)
At send time, for each recipient:
```java
if (presenceService.isOnline(recipientId)) {
    row.status = DELIVERED;  row.deliveredAt = now;   // they're connected right now
} else {
    row.status = SENT;                                // they're offline
}
```
**Key insight:** if the recipient is online at the moment you send, it's marked DELIVERED
immediately. If offline, it stays SENT until they come back. (How "online" is known:
section 12.)

### When the recipient's app marks things (the live acks)
The recipient's app sends STOMP acks, handled by `ChatController`:

- `/app/chat.delivered` → `markDelivered(recipientId, conversationId)`
  The recipient's app calls this when it *receives* messages (e.g. on reconnect for
  messages that were SENT while offline). It flips that user's SENT rows → DELIVERED and
  stamps `deliveredAt`.

- `/app/chat.read` → `markRead(recipientId, conversationId)` (+ clears unread)
  The app calls this when the user actually **opens/looks at** the chat. It flips all of
  that user's not-yet-READ rows in this conversation → READ (also back-fills
  `deliveredAt` if it was skipped). Then `notificationService.clearUnread(...)` resets the
  unread badge for that conversation.

### Telling the sender (`notifySenders`)
After a recipient's rows change to DELIVERED or READ, the sender must see their ticks
update. `notifySenders`:
1. recomputes the aggregate status for each affected message,
2. pushes a `MessageStatusUpdate` to the **sender** at `/queue/status`.

So the sender's grey ticks turn blue live, without refreshing.

**Picture (offline receiver who later reads):**
```
send: receiver offline -> row = SENT  -> sender sees single tick
receiver opens app -> /app/chat.delivered -> rows SENT->DELIVERED
                       notifySenders -> /queue/status -> sender sees double grey tick
receiver opens chat -> /app/chat.read -> rows ->READ
                       notifySenders -> /queue/status -> sender sees blue ticks
```

### Status when loading history
When you load old messages (REST), the status is computed in bulk for all of them at once
via `statusForMessages(messageIds)` — one query for all rows, grouped by message,
aggregated. This avoids one query per message (the "N+1" problem).

---

## 9. FLOW: typing indicator (`TypingService`)

Client sends to `/app/chat.typing` with `{ conversationId, typing: true/false }`.
`ChatController.typing` → `typingService.handleTyping(senderId, conversationId, typing)`.

This is **pure relay — nothing is saved to the DB**. Typing is throwaway.

- Direct (`relayDirect`): work out the other participant from the conversation id, check
  the sender is actually in it, check they aren't blocked, then push a `TypingEvent` to
  that one user at `/queue/typing`.
- Group (`relayGroup`): check sender is a member, then push the `TypingEvent` to every
  other member who hasn't blocked the sender.

The receiver's app shows "typing…" when it gets `typing:true`, and hides it on
`typing:false` (or a timeout). Because it's not persisted, it just disappears if missed.

---

## 10. FLOW: loading chat history (`ConversationController` + `ConversationService`)

This is REST, not WebSocket. When you open a chat, the frontend calls:

```
GET /api/conversations/{otherUserId}?before=<id>&limit=30      (direct)
GET /api/conversations/group/{groupId}?before=<id>&limit=30    (group)
```

Identity here comes from `SecurityUtil.currentUserId()` (JWT filter on the REST side).

### Pagination — "infinite scroll up" (`fetchPage`)
We don't load the whole history. We load a page of the **newest** messages, and load older
ones as the user scrolls up.

```java
if (beforeId == null)  // first open: newest `limit` messages
    findByConversationIdOrderByCreatedAtDesc(conversationId, page(0, limit));
else                   // scroll up: newest `limit` messages with id < beforeId
    findByConversationIdAndIdLessThanOrderByCreatedAtDesc(conversationId, beforeId, page(0, limit));

hasMore = (results.size() == limit);   // a full page back probably means more exist
Collections.reverse(results);          // DB gave newest-first; UI wants oldest-first
```
So: first call gets the latest 30 (no `before`). To get older, the client passes
`before = <id of the oldest message it currently has>`, and gets the 30 before that.
`hasMore` tells the UI whether to keep the "load more" affordance. The list is reversed so
the chat renders oldest→newest top-to-bottom. Result is wrapped in `PagedMessages
{ messages, hasMore }`.

For groups, it first checks you're a member (403 otherwise).

### Building each message for display (`toResponses` / `buildMessageResponse`)
For the page of messages, it does a few **bulk** lookups (one query each, not per
message):
- per-message status via `statusForMessages` (section 8),
- reactions via `reactionService.reactionsForMessages`,
- replied-to status previews,
- which messages the current user "deleted for me" (`hiddenMessageIdsFor`),
- which authors the current user has blocked.

Then for each message it **filters out**:
- messages older than the user's `clearedAt` (cleared chat — section 12),
- messages the user hid with "delete for me",
- messages from authors the user has blocked.

The rest become `MessageResponse` objects (content, status, ticks counts, reply info,
reactions, edited/deleted flags, media URL). `deleted` messages still appear but with null
content (the UI shows "This message was deleted").

### Other read endpoints on `ConversationController`
- `GET /api/conversations/unread-counts` → `{ conversationId: count }`, from counting
  recipient-status rows that aren't READ. Used for unread badges on the chat list.
- `GET /api/conversations/partners` → people you have direct chats with (built from
  conversations where you're sender or recipient), with their profile + last seen. Used to
  render the chat list.
- `GET /api/conversations/summaries` → `{ conversationId: lastMessageTime }` for all your
  conversations (direct + groups). Used to sort the chat list by most recent.
- `GET /api/conversations/hidden` → conversations you cleared that have had **no new
  message since** you cleared them (so the UI can hide them until a new message arrives).

---

## 11. FLOW: message info (per-person ticks) — `MessageStatusController`

```
GET /api/messages/{messageId}/status
```
→ `MessageStatusService.getMessageInfo`. Only the **sender** of the message may call it
(403 otherwise). Returns, for that message, every recipient with their individual
status + delivered/read timestamps + totals. This powers the "Message info" screen (who
read it, who only received it). For groups this is where you see per-member detail that the
aggregated tick hides.

---

## 12. FLOW: editing, deleting, clearing

### Edit — `PUT /api/messages/{messageId}` (`MessageActionService.editMessage`)
Rules, all enforced server-side:
- only the **sender** can edit (403),
- can't edit a deleted message,
- only **TEXT** messages can be edited,
- new content can't be empty,
- must be within **30 minutes** of sending (`EDIT_WINDOW`).
On success: set new content, `edited = true`, save, then **broadcast** a
`MessageEditedEvent` to everyone in the conversation at `/queue/message-edited`. Their UIs
update the text in place and show "edited."

### Delete for everyone — `DELETE /api/messages/{messageId}/for-everyone`
- only the **sender**, within **1 hour** (`DELETE_FOR_EVERYONE_WINDOW`).
- sets `deleted = true`, wipes `content` and `mediaUrl` (the words/media are gone, the row
  stays), saves, then broadcasts a `MessageDeletedEvent` to everyone at
  `/queue/message-deleted`. Their UIs replace it with "This message was deleted."

### Delete for me — `DELETE /api/messages/{messageId}/for-me`
- any participant. Inserts a `DeletedMessage` row for that user. The message is untouched
  for everyone else; it's just filtered out of *your* history (section 10). No broadcast —
  it only affects you, so nobody else needs to know.

### Clear conversation — `DELETE /api/conversations/{otherUserId}` (and `/group/{groupId}`)
- `ConversationService.clearConversation` writes/updates a `ClearedConversation` row with
  `clearedAt = now` for you. From then on, history loads filter out messages with
  `createdAt <= clearedAt` **for you only**. New messages after that still show. This is
  "clear chat," not "delete for everyone."

`recipientsOf(conversationId)` is the helper that decides who to broadcast edit/delete
events to: both participants for a direct chat, or all members for a group.

---

## 13. Supporting services

### Presence (online / last seen) — `PresenceService`
Holds an **in-memory** map `connections: userId -> open-socket-count`. (In memory =
forgotten on restart; fine, presence is live-only.)

- Spring fires `SessionConnectedEvent` when a socket opens and `SessionDisconnectEvent`
  when it closes; `@EventListener` methods catch these.
- A user may have several devices/tabs, so we **count** connections. First connection
  (count 0→1) ⇒ broadcast "online" to `/topic/presence` (everyone). Last disconnect
  (count 1→0) ⇒ record `lastSeen = now` in the DB and broadcast "offline + last seen."
- `isOnline(userId)` = "is there at least one connection?" — this is what
  `createRecipientStatuses` uses to decide SENT vs DELIVERED at send time.
- Block-aware reads: if you blocked someone (or they blocked you), presence queries return
  "offline, no last seen" so you can't see each other's status.

The methods are `synchronized` because several socket events can fire at once and they all
touch the same map; `synchronized` stops them corrupting the count.

### Notifications — `NotificationService`
Also an **in-memory** unread counter `unreadByUser: userId -> {conversationId -> count}`.

- `sendNotification(...)` (called by `ChatService` on every delivered message): bump the
  unread count for that conversation, build a short preview (media → "📎 Media", text
  trimmed to 50 chars), and push a `NotificationDto` to the recipient at
  `/queue/notifications`. Carries per-conversation and total unread counts — for badges and
  toasts.
- `clearUnread(...)` (called from `chat.read`): reset a conversation's unread count when
  the user opens it.
- `sendReactionNotification(...)`: similar, for when someone reacts to your message.

> Note: presence and notification counts live only in memory, so they reset if the server
> restarts. Persistent unread truth still comes from the recipient-status rows
> (`unread-counts` endpoint). The in-memory counter is the fast, live layer on top.

### `@Transactional` — why it's on the write methods
It groups all DB work in a method into one all-or-nothing unit. If `save` succeeds but a
later line throws, the whole thing rolls back — you never get a saved message with missing
status rows. `@Transactional(readOnly = true)` on read methods is a hint that nothing will
be written (lets the DB optimize and prevents accidental writes). It also keeps the DB
session open long enough to read **lazy** relations (e.g. `message.getSender()`), which are
not loaded until first touched (`fetch = LAZY`).

---

## 14. Quick reference

### WebSocket — client sends to `/app/...`
| Destination | Controller method | Does |
|---|---|---|
| `/app/chat.send` | `sendMessage` | send a direct message |
| `/app/group.send` | `sendGroupMessage` | send a group message |
| `/app/chat.delivered` | `markDelivered` | recipient acks receipt → ticks |
| `/app/chat.read` | `markRead` | recipient opened chat → read ticks + clear unread |
| `/app/chat.typing` | `typing` | typing on/off relay |

### WebSocket — server pushes to one user at `/user/queue/...`
| Destination | Sent by | Carries |
|---|---|---|
| `/queue/messages` | ChatService | a new message (`ChatMessageResponse`) |
| `/queue/status` | MessageStatusService | tick updates for the sender |
| `/queue/typing` | TypingService | typing events |
| `/queue/notifications` | NotificationService | unread/toast info |
| `/queue/message-edited` | MessageActionService | a message was edited |
| `/queue/message-deleted` | MessageActionService | a message was deleted for everyone |
| `/topic/presence` | PresenceService | online/offline (broadcast to all) |

### REST endpoints
| Method + path | Does |
|---|---|
| `GET /api/conversations/{otherUserId}` | direct chat history (paged) |
| `GET /api/conversations/group/{groupId}` | group chat history (paged) |
| `GET /api/conversations/unread-counts` | unread per conversation |
| `GET /api/conversations/partners` | people you DM with |
| `GET /api/conversations/summaries` | last-message time per conversation |
| `GET /api/conversations/hidden` | cleared conversations with no new messages |
| `DELETE /api/conversations/{otherUserId}` | clear a direct chat (for me) |
| `DELETE /api/conversations/group/{groupId}` | clear a group chat (for me) |
| `GET /api/messages/{messageId}/status` | per-recipient delivery info (sender only) |
| `PUT /api/messages/{messageId}` | edit a message |
| `DELETE /api/messages/{messageId}/for-me` | hide a message from my view |
| `DELETE /api/messages/{messageId}/for-everyone` | delete a message for all |

### The one-line mental model
> **WebSocket pushes live events (send, ticks, typing, presence, notifications).
> REST answers questions (history, counts, info) and does edits/deletes.
> The message row holds the text; per-recipient rows hold the ticks;
> conversation id (`dm:a:b` / `group:id`) ties everything together.**