import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { SocketProvider } from './context/SocketContext.jsx';
import { Layout, RequireRole } from './components/Layout.jsx';
import { Login } from './pages/Login.jsx';
import { MyBooks } from './pages/author/MyBooks.jsx';
import { SubmitTicket } from './pages/author/SubmitTicket.jsx';
import { MyTickets } from './pages/author/MyTickets.jsx';
import { TicketQueue } from './pages/admin/TicketQueue.jsx';
import { TicketDetail } from './pages/TicketDetail.jsx';

function HomeRedirect() {
  const { user, ready } = useAuth();
  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'admin' ? '/admin/tickets' : '/books'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route element={<Layout />}>
              <Route path="/" element={<HomeRedirect />} />

              <Route path="/books" element={<RequireRole role="author"><MyBooks /></RequireRole>} />
              <Route path="/tickets/new" element={<RequireRole role="author"><SubmitTicket /></RequireRole>} />
              <Route path="/tickets" element={<RequireRole role="author"><MyTickets /></RequireRole>} />
              <Route path="/tickets/:ticketId" element={<RequireRole role="author"><TicketDetail /></RequireRole>} />

              <Route path="/admin/tickets" element={<RequireRole role="admin"><TicketQueue /></RequireRole>} />
              <Route path="/admin/tickets/:ticketId" element={<RequireRole role="admin"><TicketDetail /></RequireRole>} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  );
}
