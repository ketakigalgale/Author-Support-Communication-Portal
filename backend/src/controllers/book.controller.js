import { asyncHandler } from '../utils/asyncHandler.js';
import * as bookService from '../services/book.service.js';

export const listMyBooks = asyncHandler(async (req, res) => {
  res.json(bookService.listBooksForAuthor(req.user.id));
});
