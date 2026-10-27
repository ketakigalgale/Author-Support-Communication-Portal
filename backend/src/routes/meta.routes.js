import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { getMeta } from '../controllers/meta.controller.js';

export const metaRouter = Router();

metaRouter.get('/', requireAuth, getMeta);
