# BookLeaf Author Support & Communication Portal

A two-sided support portal for BookLeaf Publishing: authors submit and track support tickets, admins triage and respond, and an AI layer (Anthropic Claude) classifies tickets, scores priority, and drafts replies grounded in BookLeaf's actual policies.

Built for the BookLeaf technical assignment. See `WRITEUP.md` for the one-page summary of priorities and trade-offs, and `docs/API.md` for the full endpoint reference.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 18 + Vite, plain CSS | Fast dev loop, no framework ceremony for a scoped admin/author UI |
| Backend | Node.js + Express | Minimal, explicit middleware chain, easy to review |
| Database | SQLite (`better-sqlite3`) | Zero setup for a reviewer: no DB server to install or provision, file-based, synchronous API keeps the code simple. Schema design (see below) is what's being evaluated, not the engine |
| Real-time | Socket.IO | Room-per-user and room-per-ticket, simplest model that satisfies "update without refreshing" |
| Auth | JWT + bcrypt | Email/password only, per the assignment's scope |
| AI | Anthropic Claude (`claude-3-5-haiku`) | See "AI Integration" below |

## Project layout

```
backend/
  src/
    config/       env loading
    db/           schema.sql, migrate.js, seed.js, connection.js
    middleware/    auth, validation, error handling
    services/      business logic (auth, book, ticket, ai, knowledgeBase)
    controllers/   thin HTTP adapters over services
    routes/        route tables + per-route auth/validation wiring
    sockets/       Socket.IO server + a small pub/sub bus services use to emit
    validators/    zod schemas
  data/            bookleaf_sample_data.json (seed source)
frontend/
  src/
    api/           axios client + typed endpoint functions
    context/       Auth + Socket React contexts
    components/    shared UI (badges, layout/nav)
    pages/         author/ and admin/ route screens, shared TicketDetail
docs/API.md        full endpoint reference
WRITEUP.md         1-page approach/trade-offs note
```

## Local setup

Requires Node.js 18+.

```bash
# from the repo root
npm install              # installs both workspaces (backend + frontend)

cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# edit backend/.env and add ANTHROPIC_API_KEY if you want live AI features
# (the app runs fine without it, see "Graceful degradation" below)

npm run migrate          # creates backend/data/bookleaf.db and applies schema.sql
npm run seed             # loads bookleaf_sample_data.json + creates admin accounts

npm run dev              # runs backend (:4000) and frontend (:5173) together
```

Open `http://localhost:5173`.

### Test credentials

| Role | Email | Password |
|---|---|---|
| Admin | `admin@bookleaf.com` | `admin123` |
| Admin | `support@bookleaf.com` | `admin123` |
| Author | `priya.sharma@email.com` | `bookleaf123` |
| Author | *(any author email from `bookleaf_sample_data.json`)* | `bookleaf123` |

Every seeded author shares the same password (`SEED_AUTHOR_PASSWORD` in `.env`); this is a seed-script convenience for a reviewer, not a real auth decision.

### Running the pieces separately

```bash
npm run dev -w backend     # API on :4000
npm run dev -w frontend    # Vite dev server on :5173
```

## Architecture decisions

- **Two roles, one `users` table.** An author and an admin are both just a user with a role flag; the schema doesn't gain anything by splitting them, since RBAC is enforced in middleware/services, not by table shape.
- **`book_id` is nullable on `tickets`.** A null book means "General / Account Level," per the spec, rather than a magic sentinel row or a separate ticket type.
- **Service layer owns business rules; controllers stay thin.** `ticket.service.js` is where ownership checks, AI calls, status transitions, and real-time emits happen, so the HTTP layer is just request/response plumbing. This is also where most of the "AI integration quality" and "architecture" evaluation criteria live.
- **A ticket's "original query" lives on the ticket row itself** (`subject`/`description`), not as the first row in `ticket_messages`. The message thread is purely the back-and-forth after that; it keeps "the original query vs. replies" unambiguous, which the spec calls out explicitly.
- **Socket.IO rooms, not a message queue.** `user:<id>`, `ticket:<id>`, and `role:admin` rooms are enough to satisfy every real-time requirement in the spec without adding infrastructure (Redis adapter, etc.) that a single-process demo doesn't need. A production version with multiple API instances would need the Redis adapter for Socket.IO; noted in Limitations.
- **Status auto-advances `Open` to `In Progress`** the first time an admin sends a non-internal reply. Small UX default so the queue doesn't fill up with tickets that have actually been responded to.

## AI integration

### Where AI is used

1. **Classification + priority** (`POST /tickets`): one Claude call, using **tool use** (forced function-calling) so the response is a validated enum, not free text to parse.
2. **Draft response** (`GET /tickets/:id/draft`): generated on demand, grounded in a knowledge-base excerpt scoped to the ticket's category plus the tone rules from the assignment brief.

### Prompt design

- Classification gets a short system prompt with an explicit priority rubric (what makes something Critical vs. Low) and a `classify_ticket` tool with an enum-constrained schema, so there's no "the model said Urgent but valid values are Critical/High/Medium/Low" failure mode.
- Drafting gets the **company overview + only the knowledge-base section for that ticket's category** (`backend/src/services/knowledgeBase.js`), plus the tone guidelines lifted directly from the assignment ("acknowledge before solving," "own BookLeaf's mistakes directly," "always end with a next step"). The model is explicitly told not to invent dates/amounts it wasn't given.

### Cost awareness (this is deliberately visible, not just claimed)

- **One call, not two**, for classification + priority (`classifyTicket` uses a single tool-use request for both fields).
- **Only the relevant KB section is sent**, not the whole knowledge base, every time a draft is generated (`getKnowledgeBaseExcerpt(category)`).
- **Drafts are cached** on the ticket row (`ai_draft_response`). Reopening a ticket serves the cached draft for free; only an explicit "Regenerate" click re-spends tokens.
- **No message history is replayed into the prompt.** The draft call uses only the ticket's own subject/description plus a one-line book-context summary, so prompt size doesn't grow with how long or old the ticket's conversation is. This is a real trade-off (see Limitations).
- **Input is truncated** (`MAX_DESCRIPTION_CHARS = 2000`) and outputs are capped (`max_tokens`), so a single bad-actor ticket can't blow up the cost of one call.
- Every AI call is logged to an `ai_invocations` table (model, status, input/output tokens, latency), specifically so cost and failure rate are inspectable, not just asserted in this README.

### Error handling / graceful degradation

With `ANTHROPIC_API_KEY` unset (or if the Anthropic API errors or rate-limits), the app does not break:
- Ticket creation still succeeds; `category`/`priority` fall back to `General Inquiry`/`Medium` with `*_source: "fallback"`, and the ticket carries a visible `aiClassificationError` note so admins know it wasn't actually triaged by AI.
- The draft endpoint returns `{ draft: null }`; the UI shows "AI draft unavailable, write a response manually" and the reply box works exactly as normal.
- This was manually verified end-to-end with no API key configured (see `docs/API.md` is written against the real responses, and the commit history includes the fallback-mode test pass).

### Model choice

`claude-3-5-haiku` (configurable via `ANTHROPIC_MODEL`): both AI tasks here (short classification, short grounded draft) don't need a frontier model's reasoning depth, and Haiku's latency/cost profile is a better match for a per-ticket, possibly-synchronous call in the request path.

## Known limitations / what I'd improve next

- **Draft generation doesn't see the conversation thread**, only the original query, by design (see Cost awareness). For a long-running ticket with several back-and-forth messages, a production version would summarize prior turns into a short rolling context instead of either resending everything or ignoring it entirely.
- **File attachments are UI-only**, as explicitly scoped by the assignment; real upload would need object storage (S3-compatible) and virus scanning before anything else.
- **SQLite is single-writer.** Fine for this scope and for review; a real deployment with concurrent admins would move to Postgres, which is a schema-compatible change (no SQL in the app uses SQLite-only syntax beyond `datetime('now')`).
- **Socket.IO is single-process.** Horizontal scaling needs the Redis (or similar) adapter so rooms work across instances.
- **No rate limiting on auth or ticket creation.** Would add `express-rate-limit` before any public deployment.
- **No automated test suite.** Given the 5-day scope, manual + scripted end-to-end verification (including a real-time, two-session check) was prioritized over unit tests; see `WRITEUP.md`.

## Deployment

The backend serves the API and Socket.IO; the frontend is a static Vite build. Two reasonable options:

**Single service (simplest):** build the frontend, have Express serve `frontend/dist` as static files, deploy the backend alone (Render/Railway, one Node web service). No CORS to configure, one URL.

**Two services:** deploy `backend/` to Render/Railway (set `CLIENT_ORIGIN` to the frontend's URL) and `frontend/` to Vercel/Netlify (set `VITE_API_URL` to the backend's URL). Simpler to reason about, two URLs to manage.

Either way: set `ANTHROPIC_API_KEY`, a real `JWT_SECRET`, and run `npm run migrate && npm run seed` once against the deployed database before sharing the URL.
