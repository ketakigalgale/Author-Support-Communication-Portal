import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import * as bookController from '../controllers/book.controller.js';

export const bookRouter = Router();

bookRouter.use(requireAuth, requireRole('author'));
bookRouter.get('/my-books', bookController.listMyBooks);
