import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { bookRouter } from './book.routes.js';
import { ticketRouter } from './ticket.routes.js';
import { metaRouter } from './meta.routes.js';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/books', bookRouter);
apiRouter.use('/tickets', ticketRouter);
apiRouter.use('/meta', metaRouter);
