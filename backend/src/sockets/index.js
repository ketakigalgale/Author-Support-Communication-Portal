import { Server } from 'socket.io';
import { verifyToken } from '../utils/jwt.js';
import { db } from '../db/connection.js';
import { env } from '../config/env.js';
import { setIO } from './bus.js';

export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.clientOrigin, credentials: true },
  });

  io.use((socket, next) => {
    try {
      const payload = verifyToken(socket.handshake.auth?.token ?? '');
      const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(payload.sub);
      if (!user) return next(new Error('Unauthorized'));
      socket.user = user;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.user.id}`);
    if (socket.user.role === 'admin') {
      socket.join('role:admin');
    }

    // Lets the ticket detail view get updates scoped to the ticket it's
    // looking at (used alongside the per-user room, not instead of it).
    socket.on('ticket:subscribe', (ticketId) => {
      socket.join(`ticket:${ticketId}`);
    });
    socket.on('ticket:unsubscribe', (ticketId) => {
      socket.leave(`ticket:${ticketId}`);
    });
  });

  setIO(io);
  return io;
}
