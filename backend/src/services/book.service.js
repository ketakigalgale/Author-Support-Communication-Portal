import { db } from '../db/connection.js';
import { ApiError } from '../utils/ApiError.js';

function deserialize(book) {
  return { ...book, available_on: JSON.parse(book.available_on) };
}

export function listBooksForAuthor(authorId) {
  const books = db.prepare('SELECT * FROM books WHERE author_id = ? ORDER BY publication_date DESC').all(authorId);
  return books.map(deserialize);
}

// Used by the ticket form (author's own books only) and by the admin ticket
// detail view (any book, for context). Ownership is enforced at the call site.
export function getBookById(bookId) {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);
  if (!book) throw ApiError.notFound('Book not found');
  return deserialize(book);
}

export function assertBookBelongsToAuthor(bookId, authorId) {
  const book = getBookById(bookId);
  if (book.author_id !== authorId) {
    throw ApiError.forbidden('That book does not belong to this author');
  }
  return book;
}
