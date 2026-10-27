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

    const instance = io(API_URL, { auth: { token }, transports: ['websocket', 'polling'] });
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
