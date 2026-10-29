import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import bcrypt from 'bcryptjs';
import { db } from './connection.js';
import { env } from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ADMINS = [
  { email: 'admin@bookleaf.com', name: 'Rhea Fernandes (Ops Lead)' },
  { email: 'support@bookleaf.com', name: 'Kunal Verma (Support Agent)' },
];

function resetTables() {
  db.exec(`
    DELETE FROM ai_invocations;
    DELETE FROM ticket_messages;
    DELETE FROM tickets;
    DELETE FROM books;
    DELETE FROM users;
  `);
}

function seedAdmins() {
  const insert = db.prepare(`
    INSERT INTO users (email, password_hash, role, name)
    VALUES (@email, @password_hash, 'admin', @name)
  `);
  const passwordHash = bcrypt.hashSync(env.seedAdminPassword, 10);
  for (const admin of ADMINS) {
    insert.run({ ...admin, password_hash: passwordHash });
  }
}

function seedAuthorsAndBooks() {
  const raw = fs.readFileSync(path.join(__dirname, '../../data/bookleaf_sample_data.json'), 'utf-8');
  const { authors } = JSON.parse(raw);

  const insertAuthor = db.prepare(`
    INSERT INTO users (external_id, email, password_hash, role, name, phone, city, joined_date)
    VALUES (@external_id, @email, @password_hash, 'author', @name, @phone, @city, @joined_date)
  `);
  const insertBook = db.prepare(`
    INSERT INTO books (
      external_id, author_id, title, isbn, genre, publication_date, status, mrp,
      author_royalty_per_copy, total_copies_sold, total_royalty_earned, royalty_paid,
      royalty_pending, last_royalty_payout_date, print_partner, available_on
    ) VALUES (
      @external_id, @author_id, @title, @isbn, @genre, @publication_date, @status, @mrp,
      @author_royalty_per_copy, @total_copies_sold, @total_royalty_earned, @royalty_paid,
      @royalty_pending, @last_royalty_payout_date, @print_partner, @available_on
    )
  `);

  const passwordHash = bcrypt.hashSync(env.seedAuthorPassword, 10);

  const seedAll = db.transaction(() => {
    for (const author of authors) {
      const result = insertAuthor.run({
        external_id: author.author_id,
        email: author.email,
        password_hash: passwordHash,
        name: author.name,
        phone: author.phone ?? null,
        city: author.city ?? null,
        joined_date: author.joined_date ?? null,
      });
      const authorUserId = result.lastInsertRowid;

      for (const book of author.books) {
        insertBook.run({
          external_id: book.book_id,
          author_id: authorUserId,
          title: book.title,
          isbn: book.isbn ?? null,
          genre: book.genre ?? null,
          publication_date: book.publication_date ?? null,
          status: book.status,
          mrp: book.mrp ?? null,
          author_royalty_per_copy: book.author_royalty_per_copy ?? null,
          total_copies_sold: book.total_copies_sold ?? 0,
          total_royalty_earned: book.total_royalty_earned ?? 0,
          royalty_paid: book.royalty_paid ?? 0,
          royalty_pending: book.royalty_pending ?? 0,
          last_royalty_payout_date: book.last_royalty_payout_date ?? null,
          print_partner: book.print_partner ?? null,
          available_on: JSON.stringify(book.available_on ?? []),
        });
      }
    }
  });

  seedAll();
  return authors.length;
}

export function seedDatabase() {
  console.log('Resetting tables...');
  resetTables();
  console.log('Seeding admin accounts...');
  seedAdmins();
  console.log('Seeding authors and books from bookleaf_sample_data.json...');
  const count = seedAuthorsAndBooks();
  console.log(`Seeded ${count} authors.`);
  console.log('');
  console.log('Test credentials:');
  console.log(`  Admin:  ${ADMINS[0].email} / ${env.seedAdminPassword}`);
  console.log(`  Author: priya.sharma@email.com / ${env.seedAuthorPassword}`);
  console.log('  (every seeded author shares the same password above)');
}

// Only auto-run when invoked directly (`npm run seed`), not when imported
// by server.js for the on-boot auto-seed check.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedDatabase();
}
