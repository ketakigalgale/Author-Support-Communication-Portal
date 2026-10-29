import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { db } from './connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function applySchema() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(schema);
  console.log('Database schema applied.');
}

// Only auto-run when invoked directly (`npm run migrate`), not when imported
// by server.js for the on-boot auto-migrate step.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  applySchema();
}
