import { useEffect, useState } from 'react';
import { bookApi } from '../../api/endpoints.js';
import { formatCurrency, formatDate } from '../../utils/format.js';

export function MyBooks() {
  const [books, setBooks] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    bookApi
      .myBooks()
      .then(setBooks)
      .catch(() => setError('Could not load your books.'));
  }, []);

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1>My Books</h1>
          <p>Publication status and royalty summary for everything you've published with BookLeaf.</p>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      {!books ? (
        <p>Loading...</p>
      ) : books.length === 0 ? (
        <div className="empty-state card">
          <div className="icon">📚</div>
          <p>No books on your account yet.</p>
        </div>
      ) : (
        <div className="grid grid-books">
          {books.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      )}
    </div>
  );
}

function BookCard({ book }) {
  const inProduction = book.status.startsWith('In Production');
  return (
    <div className="card book-card">
      <h3>{book.title}</h3>
      <div className="isbn">{book.isbn ?? 'ISBN pending assignment'}</div>
      <span className="pill">{book.status}</span>

      {inProduction ? (
        <p className="form-hint" style={{ marginTop: 12 }}>
          This book is still in production. Sales and royalty figures will appear once it's published.
        </p>
      ) : (
        <>
          <div className="stat-row">
            <span className="stat-label">Genre</span>
            <span className="stat-value">{book.genre}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Published</span>
            <span className="stat-value">{formatDate(book.publication_date)}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">MRP</span>
            <span className="stat-value">{formatCurrency(book.mrp)}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Copies sold</span>
            <span className="stat-value">{book.total_copies_sold}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Total royalty earned</span>
            <span className="stat-value">{formatCurrency(book.total_royalty_earned)}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Royalty paid</span>
            <span className="stat-value">{formatCurrency(book.royalty_paid)}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Royalty pending</span>
            <span className="stat-value" style={{ color: book.royalty_pending > 0 ? '#b8860b' : undefined }}>
              {formatCurrency(book.royalty_pending)}
            </span>
          </div>
        </>
      )}

      {book.available_on.length > 0 && (
        <div className="platforms">
          {book.available_on.map((platform) => (
            <span key={platform} className="pill">
              {platform}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
