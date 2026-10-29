import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ticketApi } from '../../api/endpoints.js';
import { StatusBadge, PriorityBadge } from '../../components/Badges.jsx';
import { Pagination } from '../../components/Pagination.jsx';
import { formatDateTime } from '../../utils/format.js';
import { useSocket } from '../../context/SocketContext.jsx';

export function MyTickets() {
  const [result, setResult] = useState(null);
  const [page, setPage] = useState(1);
  const socket = useSocket();

  const load = useCallback((targetPage = page) => {
    ticketApi.list({ page: targetPage }).then(setResult);
  }, [page]);

  useEffect(() => {
    load(page);
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!socket) return undefined;
    const refresh = () => load(page);
    socket.on('ticket:message', refresh);
    socket.on('ticket:updated', refresh);
    return () => {
      socket.off('ticket:message', refresh);
      socket.off('ticket:updated', refresh);
    };
  }, [socket, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const tickets = result?.data;

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1>My Tickets</h1>
          <p>Updates from BookLeaf support appear here in real time.</p>
        </div>
        <Link to="/tickets/new" className="btn btn-primary">
          + New Ticket
        </Link>
      </div>

      {!tickets ? (
        <p>Loading...</p>
      ) : tickets.length === 0 ? (
        <div className="empty-state card">
          <div className="icon">🎫</div>
          <p>You haven't submitted any tickets yet.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="ticket-row header">
            <div>Ticket</div>
            <div>Subject</div>
            <div>Book</div>
            <div>Category</div>
            <div>Priority</div>
            <div>Status</div>
          </div>
          {tickets.map((t) => (
            <Link key={t.id} to={`/tickets/${t.id}`} className="ticket-row" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="ticket-meta">{t.ticketNumber}</div>
              <div>
                <div className="ticket-subject">{t.subject}</div>
                <div className="ticket-meta">{formatDateTime(t.createdAt)}</div>
              </div>
              <div className="ticket-meta">{t.book?.title ?? 'General / Account'}</div>
              <div className="ticket-meta">{t.category}</div>
              <div><PriorityBadge priority={t.priority} /></div>
              <div><StatusBadge status={t.status} /></div>
            </Link>
          ))}
          <Pagination {...result.pagination} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
