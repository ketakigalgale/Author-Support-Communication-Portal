-- BookLeaf Author Support & Communication Portal
-- SQLite schema. Kept deliberately small and normalized: two roles share one
-- users table (role flag) because the only real difference is which routes
-- they can hit, not their shape.

CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id     TEXT UNIQUE,              -- original AUTH### id from the source dataset, null for admins
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('author', 'admin')),
  name            TEXT NOT NULL,
  phone           TEXT,
  city            TEXT,
  joined_date     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS books (
  id                        INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id               TEXT UNIQUE NOT NULL,   -- original BK### id
  author_id                 INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title                     TEXT NOT NULL,
  isbn                      TEXT,
  genre                     TEXT,
  publication_date          TEXT,
  status                    TEXT NOT NULL,
  mrp                       REAL,
  author_royalty_per_copy   REAL,
  total_copies_sold         INTEGER NOT NULL DEFAULT 0,
  total_royalty_earned      REAL NOT NULL DEFAULT 0,
  royalty_paid              REAL NOT NULL DEFAULT 0,
  royalty_pending           REAL NOT NULL DEFAULT 0,
  last_royalty_payout_date  TEXT,
  print_partner             TEXT,
  available_on              TEXT NOT NULL DEFAULT '[]' -- JSON array, stored as text (SQLite has no native array type)
);

CREATE INDEX IF NOT EXISTS idx_books_author ON books(author_id);

CREATE TABLE IF NOT EXISTS tickets (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_number      TEXT NOT NULL UNIQUE,     -- human-friendly: TCK-0001
  author_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id            INTEGER REFERENCES books(id) ON DELETE SET NULL, -- null = General / Account Level
  subject            TEXT NOT NULL,
  description        TEXT NOT NULL,
  attachments         TEXT NOT NULL DEFAULT '[]', -- JSON array of {name, size}, UI-only, no file bytes stored

  -- category/priority/status values below must match src/constants.js -
  -- SQL can't import from JS, so this is the one place those lists are
  -- necessarily duplicated rather than shared.
  category            TEXT NOT NULL DEFAULT 'General Inquiry',
  category_source      TEXT NOT NULL DEFAULT 'ai' CHECK (category_source IN ('ai', 'admin', 'fallback')),
  priority             TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Critical', 'High', 'Medium', 'Low')),
  priority_source      TEXT NOT NULL DEFAULT 'ai' CHECK (priority_source IN ('ai', 'admin', 'fallback')),

  status              TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Resolved', 'Closed')),
  assigned_admin_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,

  ai_draft_response    TEXT,       -- cached draft so we don't regenerate on every ticket open
  ai_draft_generated_at TEXT,
  ai_classification_error TEXT,    -- set when auto-classification failed and we fell back to defaults

  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tickets_author ON tickets(author_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_category ON tickets(category);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id       INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  sender_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  sender_role     TEXT NOT NULL CHECK (sender_role IN ('author', 'admin', 'system')),
  body            TEXT NOT NULL,
  is_internal_note INTEGER NOT NULL DEFAULT 0, -- 1 = admin-only note, never sent to the author
  was_ai_drafted  INTEGER NOT NULL DEFAULT 0,  -- 1 = started from the AI draft (edited or not)
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_ticket ON ticket_messages(ticket_id);

-- Lightweight record of every AI call: lets us show cost/behavior evidence
-- in the admin view and in the write-up without needing an external APM tool.
CREATE TABLE IF NOT EXISTS ai_invocations (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id         INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
  invocation_type   TEXT NOT NULL CHECK (invocation_type IN ('classification', 'draft_response')),
  model             TEXT,
  status            TEXT NOT NULL CHECK (status IN ('success', 'error', 'skipped_no_key')),
  input_tokens      INTEGER,
  output_tokens     INTEGER,
  latency_ms        INTEGER,
  error_message     TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ai_invocations_ticket ON ai_invocations(ticket_id);
