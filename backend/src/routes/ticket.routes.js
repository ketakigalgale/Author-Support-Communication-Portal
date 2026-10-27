import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  createTicketSchema,
  addMessageSchema,
  updateTicketSchema,
  ticketQuerySchema,
  draftQuerySchema,
} from '../validators/ticket.validators.js';
import * as ticketController from '../controllers/ticket.controller.js';

export const ticketRouter = Router();

ticketRouter.use(requireAuth);

ticketRouter.post('/', requireRole('author'), validate(createTicketSchema), ticketController.createTicket);
ticketRouter.get('/', validate(ticketQuerySchema, 'query'), ticketController.listTickets);
ticketRouter.get('/:ticketId', ticketController.getTicket);

ticketRouter.get('/:ticketId/messages', ticketController.listMessages);
ticketRouter.post('/:ticketId/messages', validate(addMessageSchema), ticketController.postMessage);

ticketRouter.patch('/:ticketId', requireRole('admin'), validate(updateTicketSchema), ticketController.updateTicket);
ticketRouter.get('/:ticketId/draft', requireRole('admin'), validate(draftQuerySchema, 'query'), ticketController.getDraft);
