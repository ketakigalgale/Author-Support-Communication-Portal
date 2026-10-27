# Write-up

## What I prioritized

The brief weights AI integration and architecture at 25% each, so I treated those as the actual deliverable and everything else (UI polish, extra features) as secondary. Concretely: the ticket lifecycle (create, classify, reply, resolve) and the AI layer (classification, priority, drafting, graceful degradation, cost controls) are complete and manually verified end-to-end, including a two-session test confirming real-time delivery actually works without a page refresh, not just that the sockets connect. RBAC is enforced at the middleware and service layer, not just hidden in the UI: an author hitting an admin-only route, or someone else's ticket, gets a real 403/404 from the API regardless of what the frontend shows.

I chose SQLite over Postgres/Mongo specifically so a reviewer can run `npm install && npm run migrate && npm run seed && npm run dev` with nothing else installed. The schema is ordinary relational SQL (no SQLite-specific features beyond `datetime('now')`), so moving to Postgres later is a connection-string change, not a rewrite.

## Trade-offs

- **AI drafts see the ticket's original query, not the full reply thread.** Resending growing history on every draft call scales cost with ticket age for no real benefit on a first-pass draft; a production version would summarize prior turns into a short rolling note instead.
- **File attachments are metadata only** (filename + size on the ticket), per the assignment's "UI only" scope. No storage layer was built for something explicitly marked as not required.
- **No automated test suite.** With 5 days and two 25%-weighted criteria to get right, I spent the testing budget on scripted, repeatable end-to-end verification (auth/RBAC boundaries, AI fallback behavior with no API key, real-time push across two browser sessions) rather than unit tests around code that was still being shaped. The trade-off I'd reconsider first with more time.
- **Single admin queue, no SLA/escalation automation.** The spec asks for sorting by urgency and age, which is implemented, but a real ops team would also want auto-escalation when a Critical ticket sits unanswered past some threshold. Flagged, not built.

## How I'd evolve this into production

1. **Postgres + a connection pool**, once there's more than one admin writing concurrently.
2. **Redis-backed Socket.IO adapter** the moment the API runs on more than one instance.
3. **Thread-aware AI drafting**: summarize the existing conversation into a short context block instead of only using the original query, so a draft on message 5 of a ticket is as good as message 1.
4. **Real file uploads** (S3-compatible storage, signed URLs, basic virus scanning) for the attachment field that's currently UI-only.
5. **SLA rules**: auto-escalate priority or notify a lead when a Critical/High ticket has been open past a defined window, since the queue already has everything (priority, age, assignment) needed to compute that.
6. **Audit log** on classification/priority overrides and status changes, both for support quality review and because "an admin changed this ticket's priority" is useful data the schema already half-captures via `*_source` but doesn't version over time.
