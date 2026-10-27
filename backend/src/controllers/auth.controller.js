import { asyncHandler } from '../utils/asyncHandler.js';
import * as authService from '../services/auth.service.js';

export const login = asyncHandler(async (req, res) => {
  const result = authService.login(req.body);
  res.json(result);
});

export const me = asyncHandler(async (req, res) => {
  res.json(authService.getProfile(req.user.id));
});
