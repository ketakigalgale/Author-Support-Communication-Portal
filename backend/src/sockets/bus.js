// Thin indirection so services can emit real-time events without importing
// the socket.io server directly (avoids a circular dependency between
// sockets/index.js and the services it wires up).
let ioInstance = null;

export function setIO(io) {
  ioInstance = io;
}

export function emitToUser(userId, event, payload) {
  ioInstance?.to(`user:${userId}`).emit(event, payload);
}

export function emitToAdmins(event, payload) {
  ioInstance?.to('role:admin').emit(event, payload);
}

export function emitToTicket(ticketId, event, payload) {
  ioInstance?.to(`ticket:${ticketId}`).emit(event, payload);
}
