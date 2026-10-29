# BookLeaf Support Portal API Reference

Base URL (local): `http://localhost:4000/api`

All endpoints except `POST /auth/login` require a bearer token:

```
Authorization: Bearer <token>
```

The token is returned by `POST /auth/login` and is a JWT containing the user's id, role, and email. It expires after 7 days by default (`JWT_EXPIRES_IN`).

## Error shape

Every error response has the same envelope, regardless of which route produced it:

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Validation failed",
    "details": [{ "field": "subject", "message": "Subject must be at least 5 characters" }]
  }
}
```

| HTTP status | `code`           | When |
|---|---|---|
| 400 | `BAD_REQUEST`    | Request body/query failed validation |
| 401 | `UNAUTHORIZED`   | Missing/invalid/expired token, or wrong credentials |
| 403 | `FORBIDDEN`      | Authenticated, but not allowed to touch this resource |
| 404 | `NOT_FOUND`      | Resource does not exist, or belongs to someone else (authors never learn which) |
| 409 | `CONFLICT`       | Reserved for future use (e.g. duplicate resource) |
| 500 | `INTERNAL_ERROR` | Unexpected server error (logged server-side, generic message to the client) |

## Roles

- **author**: can only read/write their own books and tickets.
- **admin**: can read/write every ticket, and additionally override classification, assign tickets, and add internal notes.

---

## Auth

### `POST /auth/login`
Public. Body:
```json
{ "email": "priya.sharma@email.com", "password": "bookleaf123" }
```
Response:
```json
{ "token": "<jwt>", "user": { "id": 3, "email": "...", "role": "author", "name": "Priya Sharma" } }
```

### `GET /auth/me`
Auth required. Returns the logged-in user's profile (id, email, role, name, phone, city, joined_date).

---

## Books

### `GET /books/my-books`
Role: `author`. Paginated (`page`, `pageSize`, same defaults as `GET /tickets`). Returns the caller's own
books (never another author's), with royalty and distribution details, exactly as recorded in
`bookleaf_sample_data.json`. Response shape: `{ "data": [...], "pagination": {...} }`.

---

## Tickets

### `POST /tickets`
Role: `author`. Creates a ticket for one of the author's own books, or a general/account-level ticket.

Body:
```json
{
  "bookId": 3,
  "subject": "Haven't received my royalty payout",
  "description": "I published 6 months ago and my dashboard still shows the full amount as pending...",
  "attachments": [{ "name": "photo.jpg", "size": 204800 }]
}
```
- `bookId` is optional/nullable, omit it (or send `null`) for a "General / Account Level" ticket.
- `attachments` is UI-only metadata (filename + size); no file bytes are uploaded or stored.

On creation, the ticket is run through AI classification (category + priority). If the AI call fails or no API key is configured, the ticket is still created with default values (`General Inquiry` / `Medium`) and `categorySource`/`prioritySource` are set to `"fallback"` so the admin UI can flag it for manual review.

Response: the created ticket object (see shape below).

### `GET /tickets`
Both roles. Paginated.
- As an **author**: returns only the caller's own tickets.
- As an **admin**: returns all tickets, filterable via query params, sorted so open/urgent/oldest tickets surface first.

Query params (all optional):
| Param | Values |
|---|---|
| `status` | `Open` \| `In Progress` \| `Resolved` \| `Closed` (admin only - ignored for authors) |
| `category` | one of the six categories, admin only (see `GET /meta`) |
| `priority` | `Critical` \| `High` \| `Medium` \| `Low`, admin only |
| `from` / `to` | `YYYY-MM-DD`, inclusive date range on `created_at`, admin only |
| `page` | default `1` |
| `pageSize` | default `20`, max `100` |

Response shape:
```json
{
  "data": [ { "id": 1, "ticketNumber": "TCK-0001", "...": "..." } ],
  "pagination": { "page": 1, "pageSize": 20, "total": 143, "totalPages": 8 }
}
```
Sorting (admin view) and pagination both happen in SQL, so `LIMIT`/`OFFSET` apply to the real sort order, not to an array that's already been filtered down in JS.

### `GET /tickets/:ticketId`
Both roles. Authors get a 403 if the ticket isn't theirs.

Ticket shape:
```json
{
  "id": 1,
  "ticketNumber": "TCK-0001",
  "subject": "...",
  "description": "...",
  "attachments": [],
  "category": "Royalty & Payments",
  "categorySource": "ai",
  "priority": "High",
  "prioritySource": "ai",
  "status": "Open",
  "createdAt": "2026-03-01 10:00:00",
  "updatedAt": "2026-03-01 10:00:00",
  "author": { "id": 3, "name": "Priya Sharma", "email": "..." },
  "book": { "id": 1, "title": "Whispers of the Ganges", "isbn": "..." },
  "assignedAdmin": null,
  "hasAiDraft": false,
  "aiClassificationError": null
}
```

### `GET /tickets/:ticketId/messages`
Both roles. Returns the message thread. Admin-only internal notes are filtered out for authors.

### `POST /tickets/:ticketId/messages`
Both roles. Body:
```json
{ "body": "Thanks for the update, following up...", "isInternalNote": false }
```
- `isInternalNote: true` is rejected with 403 unless the caller is an admin.
- When an admin sends a non-internal reply to an `Open` ticket, the ticket automatically advances to `In Progress`.
- Non-internal messages are pushed in real time (see Real-time section).

### `PATCH /tickets/:ticketId`
Role: `admin`. Body (any subset):
```json
{ "status": "Resolved", "category": "ISBN & Metadata Issues", "priority": "Critical", "assignToSelf": true }
```
Setting `category` or `priority` here marks that field's `*_source` as `"admin"` (an explicit override of the AI's call).

### `GET /tickets/:ticketId/draft?regenerate=true`
Role: `admin`. Returns `{ "draft": "...", "cached": true|false }`.
- Without `regenerate`, a previously generated draft is served from the database at no additional AI cost.
- With `regenerate=true`, a fresh draft is generated and overwrites the cache.
- `draft: null` means the AI call failed or no API key is configured; the admin writes the reply manually.

---

## Meta

### `GET /meta`
Auth required. Returns the enums the frontend needs for dropdowns, so the category/priority/status lists live in one place (the backend) instead of being duplicated in the UI:
```json
{
  "categories": ["Royalty & Payments", "ISBN & Metadata Issues", "Printing & Quality", "Distribution & Availability", "Book Status & Production Updates", "General Inquiry"],
  "priorities": ["Critical", "High", "Medium", "Low"],
  "statuses": ["Open", "In Progress", "Resolved", "Closed"]
}
```

---

## Real-time (Socket.IO)

Connect to the backend's root URL with the JWT in the handshake:
```js
io(API_URL, { auth: { token } })
```
On connect, the server joins the socket to `user:<id>` and, for admins, `role:admin`. A client can additionally join `ticket:<id>` by emitting `ticket:subscribe` (and leave with `ticket:unsubscribe`) while viewing a specific ticket.

Events emitted by the server:
| Event | Audience | Payload |
|---|---|---|
| `ticket:new` | `role:admin` | full ticket object, when an author submits a ticket |
| `ticket:message` | `user:<authorId>`, `ticket:<id>` | `{ ticketId, message }`, when a non-internal message is posted |
| `ticket:updated` | `user:<authorId>`, `ticket:<id>`, `role:admin` | full ticket object, on status/category/priority/assignment changes |
| `ticket:activity` | `role:admin` | `{ ticketId }`, a lightweight signal to refresh the queue on any new message (including internal notes) |

This is what makes "My Tickets" and the admin "Ticket Queue" update without a page refresh.
