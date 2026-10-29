import { z } from 'zod';
import { CATEGORIES, PRIORITIES, STATUSES } from '../constants.js';

export const createTicketSchema = z.object({
  bookId: z.coerce.number().int().positive().nullable().optional().default(null),
  subject: z.string().trim().min(5, 'Subject must be at least 5 characters').max(200),
  description: z.string().trim().min(10, 'Please describe the issue in a bit more detail').max(5000),
  attachments: z
    .array(z.object({ name: z.string().max(255), size: z.number().int().nonnegative() }))
    .max(5)
    .optional()
    .default([]),
});

export const addMessageSchema = z.object({
  body: z.string().trim().min(1, 'Message cannot be empty').max(5000),
  isInternalNote: z.boolean().optional().default(false),
  wasAiDrafted: z.boolean().optional().default(false),
});

export const updateTicketSchema = z
  .object({
    status: z.enum(STATUSES).optional(),
    category: z.enum(CATEGORIES).optional(),
    priority: z.enum(PRIORITIES).optional(),
    assignToSelf: z.literal(true).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

export const ticketQuerySchema = z.object({
  status: z.enum(STATUSES).optional(),
  category: z.enum(CATEGORIES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
});

export const draftQuerySchema = z.object({
  regenerate: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});
