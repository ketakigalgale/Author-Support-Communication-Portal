import { createServer } from 'node:http';
import { app } from './app.js';
import { initSocket } from './sockets/index.js';
import { env, isAiEnabled } from './config/env.js';
import { db } from './db/connection.js';
import { applySchema } from './db/migrate.js';
import { seedDatabase } from './db/seed.js';

// Self-healing bootstrap: applies the schema (idempotent, CREATE TABLE IF NOT
// EXISTS) and seeds demo data if the database is empty. This matters on free
// hosting tiers with an ephemeral filesystem (e.g. Render's free web services
// wipe local disk on every restart/redeploy/idle spin-down) - without this,
// a routine restart would silently leave the demo with no data at all.
applySchema();
const { count } = db.prepare('SELECT COUNT(*) AS count FROM users').get();
if (count === 0) {
  console.log('No users found, auto-seeding demo data...');
  seedDatabase();
}

const httpServer = createServer(app);
initSocket(httpServer);

httpServer.listen(env.port, () => {
  console.log(`BookLeaf API listening on http://localhost:${env.port}`);
  console.log(`AI integration: ${isAiEnabled ? `enabled (${env.geminiModel})` : 'disabled (no GEMINI_API_KEY set), running in fallback mode'}`);
});
