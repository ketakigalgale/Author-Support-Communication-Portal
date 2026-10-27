import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookApi, ticketApi } from '../../api/endpoints.js';
import { extractErrorMessage } from '../../api/client.js';

export function SubmitTicket() {
  const navigate = useNavigate();
  const [books, setBooks] = useState([]);
  const [bookId, setBookId] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    bookApi.myBooks().then(setBooks).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const ticket = await ticketApi.create({
        bookId: bookId ? Number(bookId) : null,
        subject,
        description,
        attachments: files.map((f) => ({ name: f.name, size: f.size })),
      });
      navigate(`/tickets/${ticket.id}`);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 640 }}>
      <div className="page-header">
        <div>
          <h1>Submit a Support Query</h1>
          <p>Our team (and AI triage) will review this and get back to you.</p>
        </div>
      </div>

      <form className="card" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="book">Which book is this about?</label>
          <select id="book" value={bookId} onChange={(e) => setBookId(e.target.value)}>
            <option value="">General / Account Level</option>
            {books.map((book) => (
              <option key={book.id} value={book.id}>
                {book.title}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="subject">Subject</label>
          <input
            id="subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Haven't received my royalty payout"
            required
            minLength={5}
            maxLength={200}
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">Describe your issue</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Give us as much detail as you can: dates, amounts, what you've already checked."
            required
            minLength={10}
            maxLength={5000}
          />
          <p className="form-hint">{description.length}/5000 characters</p>
        </div>

        <div className="form-group">
          <label htmlFor="attachments">Attachments (optional)</label>
          <input
            id="attachments"
            type="file"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
          <p className="form-hint">
            Demo scope: file names are attached to the ticket for context; files are not uploaded/stored.
          </p>
          {files.length > 0 && (
            <ul style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginTop: 6 }}>
              {files.map((f) => (
                <li key={f.name}>{f.name}</li>
              ))}
            </ul>
          )}
        </div>

        {error && <p className="form-error">{error}</p>}

        <button className="btn btn-primary" disabled={submitting}>
          {submitting ? <span className="spinner" /> : 'Submit Ticket'}
        </button>
      </form>
    </div>
  );
}
