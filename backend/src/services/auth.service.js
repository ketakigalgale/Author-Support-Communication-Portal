import bcrypt from 'bcryptjs';
import { db } from '../db/connection.js';
import { signToken } from '../utils/jwt.js';
import { ApiError } from '../utils/ApiError.js';

export function login({ email, password }) {
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const token = signToken(user);
  return {
    token,
    user: { id: user.id, email: user.email, role: user.role, name: user.name },
  };
}

export function getProfile(userId) {
  const user = db
    .prepare('SELECT id, email, role, name, phone, city, joined_date FROM users WHERE id = ?')
    .get(userId);
  if (!user) throw ApiError.notFound('User not found');
  return user;
}
