# BookLeaf Author Support & Communication Portal

Support ticket system for BookLeaf Publishing. Authors log in to see their
books and raise tickets about royalties, ISBNs, printing, whatever. Admins
get a queue, and an AI layer (Gemini) tags each ticket with a category and
priority and drafts a reply using BookLeaf's actual policies, which the
admin edits before sending.

`WRITEUP.md` has the short version of what I prioritized and what I'd do
differently with more time. `docs/API.md` has every endpoint.

## Stack

- Frontend: React + Vite, plain CSS (no Tailwind, didn't need it for this)
- Backend: Node/Express
- DB: SQLite via better-sqlite3. Chose it so there's nothing to install or
  spin up to run this, just `npm run migrate`. Schema is plain relational
  SQL, moving to Postgres later is just a connection string change.
- Real-time: Socket.IO, rooms per user/ticket plus a role:admin room
- Auth: JWT + bcrypt, email/password
- AI: Google Gemini (gemini-3.5-flash-lite), picked because it has a genuine
  free tier (no card required), see Model Choice below

## Running it

Needs Node 18+.

```bash
npm install

cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# add GEMINI_API_KEY to backend/.env if you have one (free, no card,
# from aistudio.google.com).
# it runs fine without it too, see the AI section below.

npm run migrate
npm run seed

npm run dev   # backend on :4000, frontend on :5173
```

Then open localhost:5173.

Logins after seeding:
- admin@bookleaf.com / admin123
- priya.sharma@email.com / bookleaf123 (every seeded author uses this same
  password, it's just a seed-script shortcut, not a real decision)

To run them separately: `npm run dev -w backend` and `npm run dev -w frontend`.

## Layout

```
backend/src/
  config/       env loading
  db/           schema.sql, migrate + seed scripts
  middleware/   auth, validation, error handler
  services/     auth, book, ticket, ai, knowledgeBase - business logic lives here
  controllers/  thin, just call into services
  routes/       routes + which middleware guards them
  sockets/      socket.io server + a small emit helper services use
  validators/   zod schemas
frontend/src/
  api/          axios client + endpoint functions
  context/      auth + socket context
  pages/        author/, admin/, and a shared TicketDetail both roles use
docs/API.md
WRITEUP.md
```

## A few decisions worth explaining

**The server bootstraps its own database on startup.** `server.js` applies
the schema and seeds demo data automatically if it finds an empty database,
instead of requiring `npm run migrate && npm run seed` to have been run
first. This matters for deployment: Render's free web services (and most
free tiers) have an ephemeral filesystem, meaning local disk gets wiped on
every restart, redeploy, or idle spin-down. Without this, a routine restart
would silently leave the live demo with an empty database. `npm run migrate`
/ `npm run seed` still work standalone too, for resetting to a clean slate
on purpose during local dev.

**One users table for both roles.** Author and admin are the same shape
of row with a role flag. Splitting them into two tables wouldn't buy
anything since access control happens in middleware, not in the schema.

**`tickets.book_id` is nullable.** Null means "General / Account Level."
Didn't want a separate ticket type or a fake placeholder book row for
that case.

**The original query lives on the ticket row itself**, not as the first
message in the thread. `ticket_messages` is purely the back-and-forth
after the ticket was opened. Keeps "what the author originally asked"
and "the conversation" unambiguous instead of special-casing message #1.

**Status moves Open -> In Progress automatically** the first time an
admin sends a real (non-internal) reply. Didn't want a queue full of
tickets that have actually been answered but still show as Open because
nobody flipped the dropdown.

**Socket.IO with plain rooms**, no queue, no Redis. `user:<id>`,
`ticket:<id>`, `role:admin`. That's enough for a single backend process.
If this ran on more than one instance you'd need the Redis adapter for
rooms to work across them, I didn't add it since there's only one
instance here.

## The AI part

Two places it's used:

1. When a ticket is created, one Gemini call classifies it into a
   category and a priority, using function calling (forced, via
   `FunctionCallingConfigMode.ANY`) so the model has to return a value
   from the actual enum instead of free text I'd have to parse and hope
   matches.
2. When an admin opens a ticket, a draft reply gets generated (and
   cached, see below) using the knowledge base section for that ticket's
   category plus the tone the brief described (acknowledge first, own
   BookLeaf's mistakes, give a real timeline, end with a next step). The
   admin edits it before it goes out, nothing is auto-sent.

A few things about how it's wired up, since this was the part I spent
the most time on:

- Classification and priority happen in **one call**, not two. There's
  no real reason to spend two round trips when the model can return
  both fields from a single function call.
- The draft prompt only gets the knowledge-base section relevant to that
  ticket's category (`knowledgeBase.js` splits it up), not the whole
  document every time.
- Drafts are cached on the ticket (`ai_draft_response`). Reopening a
  ticket doesn't regenerate it, only an explicit "Regenerate" click does.
- The draft prompt uses the ticket's own subject/description only, it
  doesn't resend the whole message thread. That's a real trade-off, not
  a free win, see the write-up for why.
- Description text gets truncated before it's sent and output length is
  capped, so one long or weird ticket can't spike the cost of a single call.
- Every AI call (classification or draft) gets logged to an
  `ai_invocations` table with model, token counts, latency, and
  success/failure. Wanted actual numbers to point at instead of just
  saying "it's cost aware" in a doc.

**If there's no API key, or Gemini is down or rate-limiting:**
ticket creation still works fine, it just falls back to General
Inquiry / Medium with a visible note that AI classification didn't run.
The draft endpoint returns `null` and the UI tells the admin to just
write the reply themselves. Tested this by literally not setting the key
and running the whole flow.

**Model choice:** Gemini 3.5 Flash Lite (`GEMINI_MODEL` in `.env`). Free,
no card, and more than enough for a fixed-enum classification and a
short grounded draft. Started on `gemini-2.5-flash`, moved off it after
its free tier ran out at 20 requests/day. Note for later: disabling
"thinking" is `thinkingBudget: 0` on 2.5-gen models but 3.5-gen models
reject that and want `thinkingLevel: 'MINIMAL'` instead.

## What's not done / what I'd fix next

- Draft replies don't see earlier messages in the thread, only the
  original query. Fine for a first reply, less good on message 5 of a
  long ticket. I'd summarize prior turns into a short note instead of
  either resending the whole thread or ignoring it, given more time.
- Attachments are filename + size only, no actual file storage. That
  matches what was asked for, but it's worth saying out loud.
- SQLite means one writer at a time. Not an issue here, would move to
  Postgres for anything with real concurrent admins.
- No rate limiting anywhere yet (login, ticket creation). Would add
  before this went anywhere public.
- No automated tests. I tested manually and with a couple of throwaway
  Playwright scripts (login flows, RBAC boundaries, the AI fallback
  path, and a two-browser check that replies actually show up live
  without a refresh), but there's no test suite committed. Given the
  time, I'd rather have a working, manually-verified app than partial
  test coverage on code that might still be getting shaped.

## Deploying

Backend serves the API and the socket connection. Frontend is a static
build. Simplest setup (what this repo is actually set up for): build the
frontend, then deploy just the backend as one service - `app.js` detects a
`frontend/dist` folder next to it and serves it directly, falling back to
`index.html` for client-side routes. One URL, no CORS to configure. Build
command: `npm install && npm run build`. Start command: `npm start -w backend`.

Or deploy them separately (backend on Render/Railway, frontend on Vercel)
and point `VITE_API_URL` / `CLIENT_ORIGIN` at each other.

Either way, set a real `JWT_SECRET` and `GEMINI_API_KEY`. You don't need to
run `migrate`/`seed` against the deployed instance by hand - the server
bootstraps its own schema and seed data on startup if it finds the database
empty, which also means it recovers automatically if the host's free tier
wipes local disk on a restart (see "A few decisions worth explaining" above).
