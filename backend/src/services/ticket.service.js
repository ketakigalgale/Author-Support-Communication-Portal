import { db } from '../db/connection.js';
import { ApiError } from '../utils/ApiError.js';
import { nextTicketNumber } from '../utils/ticketNumber.js';
import { assertBookBelongsToAuthor, getBookById } from './book.service.js';
import { classifyTicket, generateDraftResponse } from './ai.service.js';
import { emitToUser, emitToAdmins, emitToTicket } from '../sockets/bus.js';

const PRIORITY_RANK = { Critical: 0, High: 1, Medium: 2, Low: 3 };

function serializeTicket(row) {
  return {
    id: row.id,
    ticketNumber: row.ticket_number,
    subject: row.subject,
    description: row.description,
    attachments: JSON.parse(row.attachments),
    category: row.category,
    categorySource: row.category_source,
    priority: row.priority,
    prioritySource: row.priority_source,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: row.author_name
      ? { id: row.author_id, name: row.author_name, email: row.author_email }
      : undefined,
    book: row.book_title ? { id: row.book_id, title: row.book_title, isbn: row.book_isbn } : null,
    assignedAdmin: row.assigned_admin_name ? { id: row.assigned_admin_id, name: row.assigned_admin_name } : null,
    hasAiDraft: Boolean(row.ai_draft_response),
    aiClassificationError: row.ai_classification_error,
  };
}

const TICKET_SELECT = `
  SELECT
    t.*,
    au.name AS author_name, au.email AS author_email,
    b.title AS book_title, b.isbn AS book_isbn,
    ad.name AS assigned_admin_name
  FROM tickets t
  JOIN users au ON au.id = t.author_id
  LEFT JOIN books b ON b.id = t.book_id
  LEFT JOIN users ad ON ad.id = t.assigned_admin_id
`;

function buildBookContext(book) {
  if (!book) return null;
  const parts = [`"${book.title}"`, `status: ${book.status}`];
  if (book.royalty_pending > 0) parts.push(`royalty pending: Rs.${book.royalty_pending}`);
  if (book.last_royalty_payout_date) parts.push(`last payout: ${book.last_royalty_payout_date}`);
  return parts.join(', ');
}

export async function createTicket({ authorId, bookId, subject, description, attachments }) {
  const book = bookId ? assertBookBelongsToAuthor(bookId, authorId) : null;

  const ticketNumber = nextTicketNumber();
  const insert = db.prepare(`
    INSERT INTO tickets (ticket_number, author_id, book_id, subject, description, attachments)
    VALUES (@ticket_number, @author_id, @book_id, @subject, @description, @attachments)
  `);
  const result = insert.run({
    ticket_number: ticketNumber,
    author_id: authorId,
    book_id: bookId ?? null,
    subject,
    description,
    attachments: JSON.stringify(attachments ?? []),
  });
  const ticketId = result.lastInsertRowid;

  // AI classification runs after the row exists so a slow/failed AI call
  // never blocks or loses the ticket itself.
  const { category, priority, source } = await classifyTicket({
    ticketId,
    subject,
    description,
    bookTitle: book?.title,
  });

  db.prepare(`
    UPDATE tickets
    SET category = ?, category_source = ?, priority = ?, priority_source = ?,
        ai_classification_error = ?
    WHERE id = ?
  `).run(
    category,
    source,
    priority,
    source,
    source === 'fallback' ? 'AI classification unavailable; defaults applied.' : null,
    ticketId
  );

  const ticket = getTicketRow(ticketId);
  emitToAdmins('ticket:new', serializeTicket(ticket));
  return serializeTicket(ticket);
}

function getTicketRow(ticketId) {
  const row = db.prepare(`${TICKET_SELECT} WHERE t.id = ?`).get(ticketId);
  if (!row) throw ApiError.notFound('Ticket not found');
  return row;
}

export function getTicketForUser(ticketId, requestingUser) {
  const row = getTicketRow(ticketId);
  if (requestingUser.role === 'author' && row.author_id !== requestingUser.id) {
    throw ApiError.forbidden('This ticket does not belong to you');
  }
  return serializeTicket(row);
}

export function listTicketsForAuthor(authorId) {
  const rows = db.prepare(`${TICKET_SELECT} WHERE t.author_id = ? ORDER BY t.created_at DESC`).all(authorId);
  return rows.map(serializeTicket);
}

export function listTicketsForAdmin({ status, category, priority, from, to } = {}) {
  const clauses = [];
  const params = {};

  if (status) { clauses.push('t.status = @status'); params.status = status; }
  if (category) { clauses.push('t.category = @category'); params.category = category; }
  if (priority) { clauses.push('t.priority = @priority'); params.priority = priority; }
  if (from) { clauses.push('date(t.created_at) >= date(@from)'); params.from = from; }
  if (to) { clauses.push('date(t.created_at) <= date(@to)'); params.to = to; }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db.prepare(`${TICKET_SELECT} ${where}`).all(params);

  // Oldest + most urgent first: open/in-progress tickets surface above
  // resolved/closed ones, ranked by priority, then by age within each rank.
  const statusRank = (s) => (s === 'Open' ? 0 : s === 'In Progress' ? 1 : s === 'Resolved' ? 2 : 3);
  rows.sort((a, b) => {
    const statusDiff = statusRank(a.status) - statusRank(b.status);
    if (statusDiff !== 0) return statusDiff;
    const priorityDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(a.created_at) - new Date(b.created_at);
  });

  return rows.map(serializeTicket);
}

function touchTicket(ticketId) {
  db.prepare('UPDATE tickets SET updated_at = datetime(\'now\') WHERE id = ?').run(ticketId);
}

export function listMessages(ticketId, requestingUser) {
  const ticket = getTicketForUser(ticketId, requestingUser); // enforces ownership
  const includeInternal = requestingUser.role === 'admin';
  const rows = db
    .prepare(`
      SELECT m.*, u.name AS sender_name
      FROM ticket_messages m
      LEFT JOIN users u ON u.id = m.sender_id
      WHERE m.ticket_id = ?
      ORDER BY m.created_at ASC
    `)
    .all(ticket.id);

  return rows
    .filter((m) => includeInternal || !m.is_internal_note)
    .map((m) => ({
      id: m.id,
      senderRole: m.sender_role,
      senderName: m.sender_name,
      body: m.body,
      isInternalNote: Boolean(m.is_internal_note),
      wasAiDrafted: Boolean(m.was_ai_drafted),
      createdAt: m.created_at,
    }));
}

export function addMessage({ ticketId, requestingUser, body, isInternalNote, wasAiDrafted }) {
  const ticket = getTicketForUser(ticketId, requestingUser);

  if (isInternalNote && requestingUser.role !== 'admin') {
    throw ApiError.forbidden('Only admins can add internal notes');
  }

  const insert = db.prepare(`
    INSERT INTO ticket_messages (ticket_id, sender_id, sender_role, body, is_internal_note, was_ai_drafted)
    VALUES (@ticket_id, @sender_id, @sender_role, @body, @is_internal_note, @was_ai_drafted)
  `);
  const result = insert.run({
    ticket_id: ticket.id,
    sender_id: requestingUser.id,
    sender_role: requestingUser.role,
    body,
    is_internal_note: isInternalNote ? 1 : 0,
    was_ai_drafted: wasAiDrafted ? 1 : 0,
  });

  // A non-internal admin reply to a still-open ticket is a sensible moment
  // to auto-advance status, so queues don't fill up with answered-but-"Open" tickets.
  let statusChanged = false;
  if (requestingUser.role === 'admin' && !isInternalNote && ticket.status === 'Open') {
    db.prepare('UPDATE tickets SET status = ? WHERE id = ?').run('In Progress', ticket.id);
    statusChanged = true;
  }
  touchTicket(ticket.id);

  const message = {
    id: result.lastInsertRowid,
    senderRole: requestingUser.role,
    senderName: requestingUser.name,
    body,
    isInternalNote: Boolean(isInternalNote),
    wasAiDrafted: Boolean(wasAiDrafted),
    createdAt: new Date().toISOString(),
  };

  if (statusChanged) {
    // Push the status change too, not just the message, otherwise the
    // author/admin UIs show a stale "Open" badge until something else
    // happens to trigger a refetch.
    const updated = serializeTicket(getTicketRow(ticket.id));
    emitToUser(updated.author.id, 'ticket:updated', updated);
    emitToTicket(updated.id, 'ticket:updated', updated);
    emitToAdmins('ticket:updated', updated);
  }

  if (!isInternalNote) {
    // Real-time delivery: the author sees the admin's reply without refreshing,
    // and anyone else with the ticket open (e.g. another admin) gets it too.
    emitToUser(ticket.author.id, 'ticket:message', { ticketId: ticket.id, message });
    emitToTicket(ticket.id, 'ticket:message', { ticketId: ticket.id, message });
  }
  emitToAdmins('ticket:activity', { ticketId: ticket.id });

  return message;
}

export function updateTicket(ticketId, updates, actingAdmin) {
  const ticket = getTicketForUser(ticketId, actingAdmin);
  const fields = [];
  const params = { id: ticket.id };

  if (updates.status) { fields.push('status = @status'); params.status = updates.status; }
  if (updates.category) {
    fields.push('category = @category', "category_source = 'admin'");
    params.category = updates.category;
  }
  if (updates.priority) {
    fields.push('priority = @priority', "priority_source = 'admin'");
    params.priority = updates.priority;
  }
  if (updates.assignToSelf) {
    fields.push('assigned_admin_id = @adminId');
    params.adminId = actingAdmin.id;
  }

  if (fields.length === 0) throw ApiError.badRequest('No valid fields to update');

  db.prepare(`UPDATE tickets SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = @id`).run(params);
  touchTicket(ticket.id);

  const updated = serializeTicket(getTicketRow(ticket.id));
  emitToUser(updated.author.id, 'ticket:updated', updated);
  emitToTicket(updated.id, 'ticket:updated', updated);
  emitToAdmins('ticket:updated', updated);
  return updated;
}

export async function getOrCreateDraft(ticketId, actingAdmin, { regenerate = false } = {}) {
  const row = getTicketRow(ticketId);
  getTicketForUser(ticketId, actingAdmin); // enforces admin access via role check upstream

  if (row.ai_draft_response && !regenerate) {
    return { draft: row.ai_draft_response, cached: true };
  }

  const book = row.book_id ? getBookById(row.book_id) : null;
  const draft = await generateDraftResponse({
    ticketId: row.id,
    subject: row.subject,
    description: row.description,
    category: row.category,
    authorName: row.author_name,
    bookContext: buildBookContext(book),
  });

  if (draft) {
    db.prepare(`
      UPDATE tickets SET ai_draft_response = ?, ai_draft_generated_at = datetime('now') WHERE id = ?
    `).run(draft, row.id);
  }

  return { draft, cached: false };
}
