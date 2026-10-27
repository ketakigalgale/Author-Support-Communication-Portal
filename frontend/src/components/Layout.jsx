import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export function Layout() {
  const { user, logout } = useAuth();

  const authorLinks = [
    { to: '/books', label: 'My Books' },
    { to: '/tickets/new', label: 'Submit a Query' },
    { to: '/tickets', label: 'My Tickets' },
  ];
  const adminLinks = [{ to: '/admin/tickets', label: 'Ticket Queue' }];

  return (
    <div className="app-shell">
      <nav className="navbar">
        <div className="navbar-brand">
          Book<span>Leaf</span> Support
        </div>
        <div className="navbar-links">
          {(user?.role === 'admin' ? adminLinks : authorLinks).map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `navbar-link${isActive ? ' active' : ''}`}
            >
              {link.label}
            </NavLink>
          ))}
          <span className="navbar-user">
            {user?.name} ({user?.role})
          </span>
          <button className="btn btn-ghost" onClick={logout} style={{ color: '#cfe0ea' }}>
            Log out
          </button>
        </div>
      </nav>
      <Outlet />
    </div>
  );
}

export function RequireRole({ role, children }) {
  const { user, ready } = useAuth();
  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) {
    return <Navigate to={user.role === 'admin' ? '/admin/tickets' : '/books'} replace />;
  }
  return children;
}
