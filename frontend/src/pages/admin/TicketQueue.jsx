import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ticketApi, metaApi } from '../../api/endpoints.js';
import { StatusBadge, PriorityBadge } from '../../components/Badges.jsx';
import { formatDateTime } from '../../utils/format.js';
import { useSocket } from '../../context/SocketContext.jsx';

export function TicketQueue() {
  const [tickets, setTickets] = useState(null);
  const [meta, setMeta] = useState(null);
  const [filters, setFilters] = useState({ status: '', category: '', priority: '', from: '', to: '' });
  const socket = useSocket();

  const load = useCallback(() => {
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    ticketApi.list(params).then(setTickets);
  }, [filters]);

  useEffect(() => {
    metaApi.get().then(setMeta);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!socket) return undefined;
    socket.on('ticket:new', load);
    socket.on('ticket:activity', load);
    socket.on('ticket:updated', load);
    return () => {
      socket.off('ticket:new', load);
      socket.off('ticket:activity', load);
      socket.off('ticket:updated', load);
    };
  }, [socket, load]);

  function setFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1>Ticket Queue</h1>
          <p>Sorted so the oldest, most urgent open tickets surface first.</p>
        </div>
      </div>

      {meta && (
        <div className="filters-bar card">
          <select value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
            <option value="">All statuses</option>
            {meta.statuses.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select value={filters.category} onChange={(e) => setFilter('category', e.target.value)}>
            <option value="">All categories</option>
            {meta.categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select value={filters.priority} onChange={(e) => setFilter('priority', e.target.value)}>
            <option value="">All priorities</option>
            {meta.priorities.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="From (YYYY-MM-DD)"
            style={{ width: 160 }}
            value={filters.from}
            onChange={(e) => setFilter('from', e.target.value)}
          />
          <input
            type="text"
            placeholder="To (YYYY-MM-DD)"
            style={{ width: 160 }}
            value={filters.to}
            onChange={(e) => setFilter('to', e.target.value)}
          />
          {(filters.status || filters.category || filters.priority || filters.from || filters.to) && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setFilters({ status: '', category: '', priority: '', from: '', to: '' })}
            >
              Clear
            </button>
          )}
        </div>
      )}

      {!tickets ? (
        <p>Loading...</p>
      ) : tickets.length === 0 ? (
        <div className="empty-state card">
          <div className="icon">✅</div>
          <p>No tickets match these filters.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="ticket-row header">
            <div>Ticket</div>
            <div>Subject / Author</div>
            <div>Book</div>
            <div>Category</div>
            <div>Priority</div>
            <div>Status</div>
          </div>
          {tickets.map((t) => (
            <Link
              key={t.id}
              to={`/admin/tickets/${t.id}`}
              className="ticket-row"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div className="ticket-meta">{t.ticketNumber}</div>
              <div>
                <div className="ticket-subject">{t.subject}</div>
                <div className="ticket-meta">
                  {t.author.name} &middot; {formatDateTime(t.createdAt)}
                  {t.assignedAdmin && <> &middot; assigned to {t.assignedAdmin.name}</>}
                </div>
              </div>
              <div className="ticket-meta">{t.book?.title ?? 'General / Account'}</div>
              <div className="ticket-meta">{t.category}</div>
              <div><PriorityBadge priority={t.priority} /></div>
              <div><StatusBadge status={t.status} /></div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
