# The Block Feature — End to End

This explains blocking in Pulse: blocking/unblocking a user, listing who you blocked,
checking block status, and — most importantly — the two query directions (`hasBlocked` vs
`isBlockedBetween`) that the rest of the app uses to hide things.

The block table itself is tiny. The interesting part is how **other** features ask it
questions. You already saw those hooks in the message and contact docs; this ties them
together.

---

## 1. The big idea

A "block" is a **one-directional** record: *"I (blocker) have blocked this other user
(blocked)."* Like contacts, blocking 3 does not make 3 block you — it's one row, one
direction.

But the *effects* of a block are usually **two-directional**. If I block you:
- you can't message me, see my presence/last-seen, see my avatar in shared places, etc.,
- and I also stop seeing your live stuff in many places.

So the data is one-way, but the enforcement is "is there a block in *either* direction
between these two?" That difference is the whole reason there are two query methods
(section 5).

---

## 2. The data model — `blocks` table (`Block.java`)

```
id        auto number, primary key
blocker   FK -> users  (@ManyToOne) the person doing the blocking
blocked   FK -> users  (@ManyToOne) the person being blocked
createdAt timestamp, set once at insert
unique (blocker_id, blocked_id)
```

Same shape as `Contact`: two `@ManyToOne` links to `users` (columns `blocker_id`,
`blocked_id`), both `LAZY`. The unique constraint `(blocker_id, blocked_id)` means you
can't block the same person twice — at most one row per direction per pair.

So for a pair of users (7, 3) there can be up to **two** rows:
- `blocker=7, blocked=3` (7 blocked 3), and
- `blocker=3, blocked=7` (3 blocked 7).
They're independent. Unblocking removes only your own row.

---

## 3. The repository — `BlockRepository.java`

This is the most query-heavy repository so far, because other features need to ask blocks
several different questions. Two derived methods and three custom `@Query` ones.

```java
Optional<Block> findByBlocker_IdAndBlocked_Id(blockerId, blockedId);  // the row, if any
boolean existsByBlocker_IdAndBlocked_Id(blockerId, blockedId);        // did A block B?
List<Block> findByBlocker_Id(blockerId);                              // everyone A blocked
```

The three `@Query` ones use **JPQL** (a query language over your entities, not raw SQL —
you write entity/field names like `b.blocked.id`, not table/column names):

```java
// just the IDs of people I blocked  (lighter than loading full Block rows)
@Query("SELECT b.blocked.id FROM Block b WHERE b.blocker.id = :blockerId")
List<Long> findBlockedIdsByBlocker(blockerId);

// just the IDs of people who blocked me
@Query("SELECT b.blocker.id FROM Block b WHERE b.blocked.id = :blockedId")
List<Long> findBlockerIdsByBlocked(blockedId);

// is there a block in EITHER direction between two users?
@Query("""
    SELECT COUNT(b) > 0 FROM Block b
    WHERE (b.blocker.id = :firstUserId  AND b.blocked.id = :secondUserId)
       OR (b.blocker.id = :secondUserId AND b.blocked.id = :firstUserId)
    """)
boolean existsBlockBetween(firstUserId, secondUserId);
```

Why custom queries instead of derived method names?
- `findBlockedIdsByBlocker` / `findBlockerIdsByBlocked` select **only the id column**, not
  whole `Block` rows. When you just need a list of ids (to filter other data), pulling full
  entities is wasteful. JPQL lets you select exactly one field.
- `existsBlockBetween` has an **OR across both directions** — that's not expressible as a
  simple `findBy...` method name, so it's spelled out. This is the workhorse the app uses
  to enforce two-directional hiding from a one-directional table.

---

## 4. The controller — `BlockController.java`

Base path `/api/v1/blocks`. Caller id always from `SecurityUtil.currentUserId()`.

| Method + path | Purpose |
|---|---|
| `POST /api/v1/blocks/{userId}` | block that user |
| `DELETE /api/v1/blocks/{userId}` | unblock that user |
| `GET /api/v1/blocks` | list users I've blocked |
| `GET /api/v1/blocks/{userId}/status` | have I blocked this user? → `{ "blocked": true/false }` |

Small detail: the status endpoint returns `Map.of("blocked", true)` — a quick way to send a
tiny JSON object `{"blocked": true}` without making a dedicated DTO class for a single
boolean.

---

## 5. The service — the two question directions (the important part)

`BlockService` has two families of methods: **commands** (change data) and **queries**
(answer questions other features ask).

### Commands
- **`block(blockerId, blockedId)`**
  - can't block yourself → 400,
  - if already blocked → just return (idempotent — blocking twice is harmless, no error),
  - both users must exist (404),
  - save a `Block` row.
- **`unblock(blockerId, blockedId)`** — find my row for that person; if present, delete it.
  If there's no such row, do nothing (also idempotent).

"Idempotent" = calling it again gives the same end state without errors. Good for buttons
the user might tap twice.

### Queries (used by other features)
This is the key table to understand — which direction each method asks:

| Method | Asks | Used by |
|---|---|---|
| `hasBlocked(A, B)` | did **A** block **B**? (one direction) | block status endpoint; group delivery (skip members who blocked the sender) |
| `isBlockedBetween(A, B)` | is there a block **either way**? | direct messaging, typing, presence, contacts — most hiding |
| `blockedIdsOf(A)` | ids **A** has blocked | filtering message authors out of a feed |
| `blockersOf(A)` | ids who have blocked **A** | presence hiding |
| `listBlocked(A)` | full list for the "Blocked users" screen | block list UI |

The single most-used one is **`isBlockedBetween`**. Most features don't care *who* blocked
*whom* — if a block exists in either direction, hide the interaction. Examples you've
already seen:
- direct message send → if `isBlockedBetween`, save but don't deliver/notify,
- typing relay → if `isBlockedBetween`, don't send the typing event,
- presence → if `isBlockedBetween`, report offline / no last-seen,
- contact card → if `isBlockedBetween`, hide avatar + last-seen.

`hasBlocked` (one direction) is used where direction matters — e.g. in a group, a message
is hidden from a member **only if that member blocked the sender** (not the other way), so
the service checks the specific direction.

`blockedIdsOf` / `blockersOf` return id lists so a caller can filter a batch in memory
(e.g. "drop messages whose author I blocked" when building chat history, "hide presence for
people involved in a block with me").

---

## 6. FLOW: blocking a user

```
POST /api/v1/blocks/3
  -> blockerId = me (from JWT), blockedId = 3
  -> not myself?                (400 if self)
  -> already blocked? -> return (no-op)
  -> both users exist?          (404 if not)
  -> save Block(blocker=me, blocked=3)
  -> 200 ok
```

After this, every other feature that calls `isBlockedBetween(me, 3)` (or `hasBlocked`) will
start returning true and hide accordingly. Blocking doesn't delete past messages or the
contact — it just gates future interaction and live info. (See the message/contact/presence
docs for exactly what each one hides.)

---

## 7. FLOW: listing blocked users (`listBlocked`)

`GET /api/v1/blocks` → all my `Block` rows → for each, build a `BlockedUserResponse`:

```
userId    the blocked person's id
name      their name
phone     their phone
avatarUrl presigned image
blockedAt when I blocked them
```

This is the "Blocked contacts" settings screen. Note it shows the blocked person's avatar
here on purpose — it's *your own* list of people *you* blocked, so you need to recognize
them. (The hiding rules apply to interactions, not to your own block-management screen.)

---

## 8. Quick reference

### Endpoints
| Method + path | Returns |
|---|---|
| `POST /api/v1/blocks/{userId}` | block (idempotent) |
| `DELETE /api/v1/blocks/{userId}` | unblock (idempotent) |
| `GET /api/v1/blocks` | list of blocked users |
| `GET /api/v1/blocks/{userId}/status` | `{ "blocked": bool }` |

### Service queries other features call
| Method | Direction |
|---|---|
| `hasBlocked(A, B)` | A→B only |
| `isBlockedBetween(A, B)` | either direction |
| `blockedIdsOf(A)` | ids A blocked |
| `blockersOf(A)` | ids who blocked A |

### The one-line mental model
> **A block is a one-way `blocker → blocked` row, but enforcement is usually two-way:
> `isBlockedBetween` ("either direction") is the question most features ask to hide
> messages, typing, presence, and contact info; `hasBlocked` is used where direction
> actually matters (group delivery).**