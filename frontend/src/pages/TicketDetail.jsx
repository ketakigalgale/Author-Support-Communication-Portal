import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ticketApi, metaApi } from '../api/endpoints.js';
import { extractErrorMessage } from '../api/client.js';
import { StatusBadge, PriorityBadge, SourceTag } from '../components/Badges.jsx';
import { formatDateTime } from '../utils/format.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';

export function TicketDetail() {
  const { ticketId } = useParams();
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const socket = useSocket();

  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [meta, setMeta] = useState(null);
  const [replyBody, setReplyBody] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftFetched, setDraftFetched] = useState(false);
  const [error, setError] = useState('');
  const threadEndRef = useRef(null);

  const loadTicket = useCallback(() => {
    ticketApi.get(ticketId).then(setTicket).catch(() => setError('Ticket not found.'));
  }, [ticketId]);

  const loadMessages = useCallback(() => {
    ticketApi.messages(ticketId).then(setMessages);
  }, [ticketId]);

  useEffect(() => {
    loadTicket();
    loadMessages();
    if (isAdmin) metaApi.get().then(setMeta);
  }, [loadTicket, loadMessages, isAdmin]);

  // Real-time: join this ticket's room so replies from the other side show
  // up without a manual refresh.
  useEffect(() => {
    if (!socket) return undefined;
    socket.emit('ticket:subscribe', ticketId);
    const onMessage = (payload) => {
      if (String(payload.ticketId) === String(ticketId)) loadMessages();
    };
    const onUpdated = (payload) => {
      if (String(payload.id) === String(ticketId)) setTicket(payload);
    };
    socket.on('ticket:message', onMessage);
    socket.on('ticket:updated', onUpdated);
    return () => {
      socket.emit('ticket:unsubscribe', ticketId);
      socket.off('ticket:message', onMessage);
      socket.off('ticket:updated', onUpdated);
    };
  }, [socket, ticketId, loadMessages]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages]);

  // Auto-fetch the AI draft once for admins on open tickets. Cheap: the
  // backend serves a cached draft if one already exists for this ticket.
  useEffect(() => {
    if (!isAdmin || !ticket || draftFetched) return;
    if (ticket.status === 'Resolved' || ticket.status === 'Closed') return;
    setDraftFetched(true);
    setDraftLoading(true);
    ticketApi
      .draft(ticketId)
      .then((res) => setDraft(res.draft))
      .finally(() => setDraftLoading(false));
  }, [isAdmin, ticket, ticketId, draftFetched]);

  async function handleSend(e) {
    e.preventDefault();
    if (!replyBody.trim()) return;
    setSending(true);
    setError('');
    try {
      await ticketApi.addMessage(ticketId, {
        body: replyBody,
        isInternalNote,
        wasAiDrafted: Boolean(draft) && replyBody.trim() === draft.trim(),
      });
      setReplyBody('');
      setIsInternalNote(false);
      loadMessages();
      loadTicket();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSending(false);
    }
  }

  async function handleUpdate(fields) {
    try {
      const updated = await ticketApi.update(ticketId, fields);
      setTicket(updated);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }

  async function handleRegenerateDraft() {
    setDraftLoading(true);
    try {
      const res = await ticketApi.draft(ticketId, true);
      setDraft(res.draft);
    } finally {
      setDraftLoading(false);
    }
  }

  if (error && !ticket) {
    return (
      <div className="container">
        <p className="form-error">{error}</p>
      </div>
    );
  }
  if (!ticket) return <div className="container">Loading...</div>;

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1>{ticket.subject}</h1>
          <p>
            {ticket.ticketNumber} &middot; {ticket.book?.title ?? 'General / Account Level'} &middot; opened{' '}
            {formatDateTime(ticket.createdAt)}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <PriorityBadge priority={ticket.priority} />
          <StatusBadge status={ticket.status} />
        </div>
      </div>

      <div className="ticket-detail-layout">
        <div>
          <div className="card">
            <h4 style={{ marginTop: 0 }}>Original query</h4>
            <p style={{ whiteSpace: 'pre-wrap' }}>{ticket.description}</p>
            {ticket.attachments.length > 0 && (
              <p className="form-hint">Attached: {ticket.attachments.map((a) => a.name).join(', ')}</p>
            )}
            {ticket.aiClassificationError && (
              <p className="form-hint" style={{ color: 'var(--color-warning)' }}>
                {ticket.aiClassificationError}
              </p>
            )}
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h4 style={{ marginTop: 0 }}>Conversation</h4>
            <div className="message-thread">
              {messages.length === 0 && <p className="form-hint">No replies yet.</p>}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`message-bubble ${m.senderRole}${m.isInternalNote ? ' internal' : ''}`}
                >
                  <div className="message-meta">
                    <span>
                      {m.senderName ?? 'System'} {m.isInternalNote && '(internal note)'}
                      {m.wasAiDrafted && <span className="badge badge-ai" style={{ marginLeft: 6 }}>AI-drafted</span>}
                    </span>
                    <span>{formatDateTime(m.createdAt)}</span>
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{m.body}</div>
                </div>
              ))}
              <div ref={threadEndRef} />
            </div>

            {isAdmin && (draftLoading || draft) && (
              <div className="ai-draft-box">
                <div className="ai-draft-label">✦ AI-drafted response</div>
                {draftLoading ? (
                  <p className="ai-unavailable"><span className="spinner" /> Generating...</p>
                ) : (
                  <>
                    <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.88rem' }}>{draft}</p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setReplyBody(draft)}>
                        Use this draft
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={handleRegenerateDraft}>
                        Regenerate
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            {isAdmin && draftFetched && !draftLoading && !draft && (
              <p className="ai-unavailable">AI draft unavailable right now. Write a response manually below.</p>
            )}

            <form onSubmit={handleSend} style={{ marginTop: 16 }}>
              <div className="form-group">
                <label htmlFor="reply">
                  {isInternalNote ? 'Internal note (not visible to the author)' : 'Reply'}
                </label>
                <textarea
                  id="reply"
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder={isAdmin ? 'Write a response to the author...' : 'Add more detail or ask a follow-up...'}
                  required
                />
              </div>
              {isAdmin && (
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    id="internal"
                    type="checkbox"
                    style={{ width: 'auto' }}
                    checked={isInternalNote}
                    onChange={(e) => setIsInternalNote(e.target.checked)}
                  />
                  <label htmlFor="internal" style={{ margin: 0 }}>
                    Internal note only (author won't see this)
                  </label>
                </div>
              )}
              {error && <p className="form-error">{error}</p>}
              <button className="btn btn-primary" disabled={sending}>
                {sending ? <span className="spinner" /> : isInternalNote ? 'Save Note' : 'Send Reply'}
              </button>
            </form>
          </div>
        </div>

        <div>
          <div className="card sidebar-section">
            <h4>Ticket Info</h4>
            <div className="kv-row"><span className="k">Author</span><span>{ticket.author.name}</span></div>
            <div className="kv-row"><span className="k">Email</span><span>{ticket.author.email}</span></div>
            <div className="kv-row"><span className="k">Assigned to</span><span>{ticket.assignedAdmin?.name ?? 'Unassigned'}</span></div>
            <div className="kv-row"><span className="k">Last updated</span><span>{formatDateTime(ticket.updatedAt)}</span></div>

            {isAdmin && !ticket.assignedAdmin && (
              <button className="btn btn-secondary btn-sm" style={{ marginTop: 10 }} onClick={() => handleUpdate({ assignToSelf: true })}>
                Assign to me
              </button>
            )}
          </div>

          <div className="card sidebar-section" style={{ marginTop: 16 }}>
            <h4>Classification</h4>
            <div className="kv-row">
              <span className="k">Category</span>
              <span>{ticket.category}</span>
            </div>
            <div style={{ marginBottom: 8 }}><SourceTag source={ticket.categorySource} /></div>
            <div className="kv-row">
              <span className="k">Priority</span>
              <span>{ticket.priority}</span>
            </div>
            <div><SourceTag source={ticket.prioritySource} /></div>

            {isAdmin && meta && (
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={{ fontSize: '0.78rem' }}>Override category</label>
                  <select value={ticket.category} onChange={(e) => handleUpdate({ category: e.target.value })}>
                    {meta.categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem' }}>Override priority</label>
                  <select value={ticket.priority} onChange={(e) => handleUpdate({ priority: e.target.value })}>
                    {meta.priorities.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem' }}>Status</label>
                  <select value={ticket.status} onChange={(e) => handleUpdate({ status: e.target.value })}>
                    {meta.statuses.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
