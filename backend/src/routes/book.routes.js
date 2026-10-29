import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { bookQuerySchema } from '../validators/book.validators.js';
import * as bookController from '../controllers/book.controller.js';

export const bookRouter = Router();

bookRouter.use(requireAuth, requireRole('author'));
bookRouter.get('/my-books', validate(bookQuerySchema, 'query'), bookController.listMyBooks);
