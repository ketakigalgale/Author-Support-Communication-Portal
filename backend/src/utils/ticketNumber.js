import { db } from '../db/connection.js';

// TCK-0001, TCK-0002, ... derived from the current row count. Good enough
// for a single-writer SQLite setup; a high-concurrency system would use a
// dedicated sequence instead.
export function nextTicketNumber() {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM tickets').get();
  return `TCK-${String(count + 1).padStart(4, '0')}`;
}
