import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { API_URL } from '../api/client.js';
import { useAuth } from './AuthContext.jsx';

const SocketContext = createContext(null);

// A single socket connection for the whole app, created once per logged-in
// session and shared via context, rather than one connection per component
// that happens to want real-time updates.
export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('bookleaf_token');
    if (!user || !token) {
      setSocket(null);
      return undefined;
    }

    // socket.io-client connects to the current page's origin when given
    // undefined, but treats an empty string differently - so an empty
    // API_URL (same-origin deployment, see api/client.js) must become
    // undefined here, not be passed through as-is.
    const instance = io(API_URL || undefined, { auth: { token }, transports: ['websocket', 'polling'] });
    setSocket(instance);

    return () => {
      instance.disconnect();
      setSocket(null);
    };
  }, [user]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}
