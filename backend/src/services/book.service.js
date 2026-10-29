import { db } from '../db/connection.js';
import { ApiError } from '../utils/ApiError.js';
import { normalizePagination, buildPaginationMeta } from '../utils/pagination.js';

function deserialize(book) {
  return { ...book, available_on: JSON.parse(book.available_on) };
}

export function listBooksForAuthor(authorId, pagination = {}) {
  const { page, pageSize, offset } = normalizePagination(pagination);

  const { total } = db.prepare('SELECT COUNT(*) AS total FROM books WHERE author_id = ?').get(authorId);
  const books = db
    .prepare('SELECT * FROM books WHERE author_id = @authorId ORDER BY publication_date DESC LIMIT @pageSize OFFSET @offset')
    .all({ authorId, pageSize, offset });

  return { data: books.map(deserialize), pagination: buildPaginationMeta({ page, pageSize }, total) };
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
