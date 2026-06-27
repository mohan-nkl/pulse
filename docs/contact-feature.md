# The Contact Feature — End to End

This explains everything about contacts in Pulse: what a contact is, adding contacts
(by phone, by user id), the phone-book sync, aliases (nicknames), search, and removal.

It's an all-REST feature (no WebSocket), so it's a good one to cement the basic
Controller → Service → Repository flow.

---

## 1. The big idea

A "contact" is a **one-directional link**: *"I (owner) have saved this other user (contact)
in my list, optionally under a nickname (alias)."*

One-directional is the key word. If user 7 adds user 3, that creates **one** row: owner=7,
contact=3. It does NOT add 7 to 3's list. Like saving a number in your phone — saving
someone doesn't put you in their phone.

What the feature gives the rest of the app:
- a personal address book per user (the chat "new chat" / people screen),
- nicknames (you can call user 3 "Mom" even though their profile name is "Sarah"),
- phone-book sync ("which of my phone contacts are on Pulse?"),
- a "is this person saved?" check used elsewhere (e.g. notifications show a saved name vs a
  raw phone number).

---

## 2. The data model — `contacts` table (`Contact.java`)

```
id        auto number, primary key
owner     FK -> users   (@ManyToOne) the person who owns this list entry
contact   FK -> users   (@ManyToOne) the person being saved
alias     string, nullable — the nickname owner gave them
addedAt   timestamp, set once at insert
unique (owner_id, contact_id)
```

Two things to understand:

**Two links to `users`.** A `Contact` row points at the `users` table **twice** — once for
`owner`, once for `contact`. Both are `@ManyToOne` (one user can be the owner of many
contact rows; one user can be the saved contact in many people's lists). In the DB these
are columns `owner_id` and `contact_id`, each a foreign key to `users.id`.

**The unique constraint `(owner_id, contact_id)`.** This stops you saving the same person
twice. There can be at most one row for "owner 7 → contact 3." It's the DB-level safety net
behind the "Contact already added" check in the service.

`fetch = FetchType.LAZY` on both: the linked `User` objects aren't loaded from the DB until
you actually call `contact.getContact()` / `contact.getOwner()`. Saves work when you don't
need them.

`addedAt` uses `@CreationTimestamp` + `updatable = false` — set automatically on insert,
never changes after.

---

## 3. The repository — `ContactRepository.java`

Three derived query methods on top of the usual `JpaRepository` freebies
(`save`, `delete`, `findById`, …):

```java
List<Contact> findByOwner_Id(Long ownerId);
Optional<Contact> findByOwner_IdAndContact_Id(Long ownerId, Long contactId);
Optional<Contact> findByIdAndOwner_Id(Long id, Long ownerId);
```

Note the underscore: `findByOwner_Id` means "navigate into the `owner` relation, then its
`id` field." So it generates `WHERE owner_id = ?`. Spring builds the SQL from the method
name (same trick as everywhere in this app).

- `findByOwner_Id` → "all my contacts."
- `findByOwner_IdAndContact_Id` → "do I already have this specific person?" (used for the
  duplicate check).
- `findByIdAndOwner_Id` → "fetch contact row N, **but only if I own it**." This second
  condition is an **ownership guard** — it makes sure you can't touch someone else's
  contact row by guessing its id. More on this in section 6.

---

## 4. The controller — `ContactController.java`

Base path `/api/v1/contacts`. Every method gets the caller's id from
`SecurityUtil.currentUserId()` (set by the JWT filter) — never from the request body.

| Method + path | Purpose |
|---|---|
| `GET /api/v1/contacts` | list my contacts |
| `GET /api/v1/contacts/search?q=...` | search within my contacts |
| `POST /api/v1/contacts` | add by phone number (body: phone, alias) |
| `POST /api/v1/contacts/user/{userId}` | add by user id (no body) |
| `POST /api/v1/contacts/sync` | phone-book sync (body: list of phones) |
| `PATCH /api/v1/contacts/{id}/alias` | rename a contact |
| `DELETE /api/v1/contacts/{id}` | remove a contact |

One small difference from the message controllers: these methods return
`ResponseEntity<ApiResponse<...>>` instead of a bare `ApiResponse<...>`. `ResponseEntity`
is a wrapper that lets the controller **set the HTTP status code explicitly**. That's why
`addContact` can return `201 CREATED` (the correct status for "a new thing was made")
instead of the default `200 OK`. Everything else still returns the same `ApiResponse`
envelope inside.

HTTP verbs used, and what they mean:
- `GET` — read, no change.
- `POST` — create something.
- `PATCH` — partial update (change one field; here, the alias).
- `DELETE` — remove.

---

## 5. FLOW: adding a contact by phone (`addContact`)

Client: `POST /api/v1/contacts` with `{ "phone": "9991112222", "alias": "Mom" }`.

`AddContactRequest` requires `phone` (`@NotBlank`); `alias` is optional.

Service steps (`ContactService.addContact`):

1. **Load the owner** — me (`findUserOrThrow(ownerId)`), 404 if somehow missing.
2. **Find the user being added by phone** — `findUserByPhoneOrThrow(phone)`. If no Pulse
   user has that phone → 404 "No Pulse user found with that phone number." (You can only
   add people who are on the app.)
3. **`ensureNotSelf`** — you can't add yourself → 400.
4. **`ensureNotAlreadyContact`** — if a row owner→contact already exists → 409 CONFLICT
   "Contact already added." (Backed up by the DB unique constraint.)
5. **Build + save** the `Contact` (owner, contact, cleaned alias). `cleanAlias` trims
   whitespace and turns blank/empty into `null` (so you don't store `""`).
6. **Return** `toResponse(savedContact)` (section 8) with status `201 CREATED`.

```
POST /contacts {phone, alias}
  -> load me
  -> find target by phone        (404 if not on Pulse)
  -> not myself? not already saved?   (400 / 409)
  -> save Contact(owner=me, contact=target, alias)
  -> 201 + ContactResponse
```

---

## 6. FLOW: the other small operations

### Add by user id (`addContactByUserId`)
`POST /api/v1/contacts/user/{userId}`. Same as add-by-phone, but the target is found
directly by id instead of phone, and there's no alias. Used when you already have someone's
user id on screen (e.g. you tapped their profile) rather than typing a phone number.

### Update alias (`updateAlias`)
`PATCH /api/v1/contacts/{id}/alias` with `{ "alias": "Dad" }`.
- `findOwnedContactOrThrow(contactId, ownerId)` uses `findByIdAndOwner_Id` — it loads the
  row **only if you own it**. If the id doesn't exist *or* belongs to someone else → 404.
  Same 404 either way, so you can't even tell whether someone else's contact id exists.
- Set the cleaned alias, save, return updated response.

This ownership guard is the important pattern: **never trust the path id alone.** Always
scope it to the current user so people can't edit each other's data by guessing ids.

### Remove contact (`removeContact`)
`DELETE /api/v1/contacts/{id}`. Same ownership guard, then `contactRepository.delete(...)`.
Returns "Contact removed." Deleting your contact row only removes *your* link; it doesn't
affect the other person.

---

## 7. FLOW: search (`searchContacts`)

`GET /api/v1/contacts/search?q=mo`.

- If `q` is blank → just return the full list (`listContacts`).
- Otherwise load all my contacts and filter **in Java** (`matchesQuery`): keep a contact if
  the query (case-insensitive) appears in the **alias**, the contact's **name**, or the
  **phone**.

Note this is in-memory filtering, not a DB query — fine for a personal contact list (small
number of rows per user). If contact lists were huge you'd push this filter into SQL, but
here simplicity wins.

---

## 8. FLOW: phone-book sync (`syncPhones`)

This powers "find which of my phone contacts are on Pulse." The phone uploads all the phone
numbers from its address book; the server says which ones are Pulse users and which you've
already saved.

Client: `POST /api/v1/contacts/sync` with `{ "phones": ["999...", "888...", ...] }`
(`SyncRequest` requires the list be non-empty, `@NotEmpty`).

Service steps:
1. **`userRepository.findByPhoneIn(phones)`** — one query: all Pulse users whose phone is in
   the uploaded list. (`findByPhoneIn` → `WHERE phone IN (?, ?, …)`.)
2. **`buildExistingContactMap(ownerId)`** — load my existing contacts into a map
   `contactUserId -> contactRecordId`. This lets us mark, for each match, whether it's
   already saved (and give the existing record id).
3. For each matched user (skipping myself), build a `SyncedUserResponse`:
   - `userId`, `name`, `avatarUrl` (presigned),
   - `alreadyContact` — true if it's in my map,
   - `contactRecordId` — the existing contact row id if saved, else null.

The frontend uses this to show "Sarah is on Pulse ✓ (already a contact)" vs "Bob is on
Pulse — [Add]".

```
POST /contacts/sync {phones:[...]}
  -> find all Pulse users with those phones   (1 query, IN clause)
  -> map of my existing contacts
  -> for each match (not me): {userId, name, avatar, alreadyContact, contactRecordId}
```

---

## 9. The block hook — why contacts know about blocks

`ContactService` depends on `BlockService`, used in one spot: `toResponse`.

```java
boolean hiddenByBlock = blockService.isBlockedBetween(contactUser.getId(), ownerId);
if (!hiddenByBlock) {
    avatarUrl = presignedUrl(...);
    lastSeen  = contactUser.getLastSeen();
}
```

If you and a saved contact have blocked each other (either direction), the contact still
shows in your list (name + alias stay), but their **avatar and last-seen are hidden**
(returned as null). This matches WhatsApp-style behavior: a block doesn't erase the contact,
it just cuts off the live/personal info. (The block feature itself is documented separately.)

---

## 10. The response DTO — `ContactResponse`

What the client gets for a contact:
```
id         the contact ROW id (use this to edit/delete the contact)
contactId  the saved person's USER id (use this to open a chat, view profile)
name       the person's profile name
alias      your nickname for them (may be null)
avatarUrl  presigned image url (null if hidden by block)
lastSeen   their last-seen time (null if hidden by block)
addedAt    when you saved them
```

The two id fields trip people up, so be clear:
- **`id`** = the contact record's own id → used for `/contacts/{id}/alias` and
  `/contacts/{id}` (rename/delete the *link*).
- **`contactId`** = the other user's id → used to start a conversation, fetch their profile,
  etc.

`SyncedUserResponse` (sync result) instead exposes `userId` + `alreadyContact` +
`contactRecordId`, because at sync time the person may not be saved yet (so there's no
contact row id unless `alreadyContact` is true).

Both response DTOs use Lombok's `@Builder` — that's the `ContactResponse.builder().id(..)
.name(..).build()` style: a readable way to construct an object field by field. Request DTOs
(`AddContactRequest`, `SyncRequest`) instead use `@Setter`/`@NoArgsConstructor` because
Jackson fills them from incoming JSON.

---

## 11. Quick reference

### Endpoints
| Method + path | Body | Returns | Notes |
|---|---|---|---|
| `GET /api/v1/contacts` | — | list of contacts | mine only |
| `GET /api/v1/contacts/search?q=` | — | filtered contacts | matches alias/name/phone |
| `POST /api/v1/contacts` | phone, alias? | the new contact (201) | target must be on Pulse |
| `POST /api/v1/contacts/user/{userId}` | — | the new contact (201) | add by id |
| `POST /api/v1/contacts/sync` | phones[] | which are on Pulse / saved | phone-book match |
| `PATCH /api/v1/contacts/{id}/alias` | alias | updated contact | own contact only |
| `DELETE /api/v1/contacts/{id}` | — | message | own contact only |

### Rules enforced server-side
- target must be an existing Pulse user (404 otherwise),
- can't add yourself (400),
- can't add a duplicate (409, + DB unique constraint),
- can only rename/delete contacts you own (404 otherwise),
- blocked contacts keep name/alias but hide avatar + last seen.

### The one-line mental model
> **A contact is a one-way `owner → contact` row with an optional alias. Add by phone or id,
> sync matches a phone-book against Pulse users, every write is scoped to the current user
> so you can only touch your own rows, and blocks hide the personal fields but keep the entry.**