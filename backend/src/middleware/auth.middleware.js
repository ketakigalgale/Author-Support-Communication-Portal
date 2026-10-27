import { verifyToken } from '../utils/jwt.js';
import { ApiError } from '../utils/ApiError.js';
import { db } from '../db/connection.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(ApiError.unauthorized('Missing bearer token'));
  }

  try {
    const payload = verifyToken(header.slice('Bearer '.length));
    const user = db.prepare('SELECT id, email, role, name FROM users WHERE id = ?').get(payload.sub);
    if (!user) {
      return next(ApiError.unauthorized('Account no longer exists'));
    }
    req.user = user;
    next();
  } catch {
    return next(ApiError.unauthorized('Invalid or expired token'));
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(ApiError.forbidden());
    }
    next();
  };
}
