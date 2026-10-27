import { asyncHandler } from '../utils/asyncHandler.js';
import * as ticketService from '../services/ticket.service.js';

export const createTicket = asyncHandler(async (req, res) => {
  const ticket = await ticketService.createTicket({ authorId: req.user.id, ...req.body });
  res.status(201).json(ticket);
});

export const listTickets = asyncHandler(async (req, res) => {
  const tickets =
    req.user.role === 'admin'
      ? ticketService.listTicketsForAdmin(req.query)
      : ticketService.listTicketsForAuthor(req.user.id);
  res.json(tickets);
});

export const getTicket = asyncHandler(async (req, res) => {
  res.json(ticketService.getTicketForUser(Number(req.params.ticketId), req.user));
});

export const listMessages = asyncHandler(async (req, res) => {
  res.json(ticketService.listMessages(Number(req.params.ticketId), req.user));
});

export const postMessage = asyncHandler(async (req, res) => {
  const message = ticketService.addMessage({
    ticketId: Number(req.params.ticketId),
    requestingUser: req.user,
    ...req.body,
  });
  res.status(201).json(message);
});

export const updateTicket = asyncHandler(async (req, res) => {
  const ticket = ticketService.updateTicket(Number(req.params.ticketId), req.body, req.user);
  res.json(ticket);
});

export const getDraft = asyncHandler(async (req, res) => {
  const result = await ticketService.getOrCreateDraft(Number(req.params.ticketId), req.user, {
    regenerate: req.query.regenerate,
  });
  res.json(result);
});
