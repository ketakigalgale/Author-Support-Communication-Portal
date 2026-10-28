# Write-up

## What I prioritized

Given five days, I spent most of the time on the ticket lifecycle and the
AI layer, since that's the actual product here, everything else (nicer
filters, extra UI polish) is secondary to "does a ticket get classified
correctly and does the admin get a usable draft." Those two things are
done and I tested them properly, not just happy-path: RBAC boundaries
(an author hitting an admin route gets a real 403 from the API, not just
a hidden button), the AI fallback path with no API key configured, and
real-time delivery checked across two actual browser sessions so I could
confirm a reply shows up on the author's side without them touching
refresh.

I used SQLite instead of Postgres mainly so this runs with `npm install
&& npm run migrate && npm run seed` and nothing else to set up. The
schema itself is ordinary SQL, no SQLite-only tricks, so swapping the
engine later is a connection string change, not a rewrite.

## Trade-offs I made on purpose

- AI drafts only see the ticket's original message, not the full
  back-and-forth. Resending a growing thread on every draft call gets
  expensive for no real benefit on a first reply. I'd fix this by
  summarizing older messages into a short note rather than including
  everything, but didn't think it was worth building for a demo dataset
  where most tickets have zero or one reply.
- Attachments are filename and size only, no actual upload. That's what
  was asked for, so I didn't build storage for something explicitly out
  of scope.
- No automated tests. With limited time and two things that actually
  needed to work correctly (AI integration, RBAC), I spent the testing
  budget on real end-to-end checks instead of unit tests around code
  that was still changing. If I had another day, this is what I'd add first.
- No escalation/SLA logic. The queue sorts by urgency and age like it
  was asked to, but a real ops team would also want something to flag a
  Critical ticket that's been sitting for too long. Didn't build it,
  worth noting.

## If this went to production

- Postgres once there's more than one admin writing at the same time.
- The Redis adapter for Socket.IO once the backend runs on more than one
  instance (rooms don't work across processes without it).
- Make draft generation thread-aware, so a reply on an old ticket with
  several messages is as good as the first reply.
- Real file uploads for attachments, with actual storage and some basic
  scanning before anything touches disk.
- Some kind of SLA rule, auto-escalate or at least notify someone when a
  Critical/High ticket has sat open past a set window.
- An audit trail on classification/priority overrides. The schema
  already tracks whether a value is AI-set or admin-set, but not a
  history of who changed what and when.
