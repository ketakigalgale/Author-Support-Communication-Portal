import { createServer } from 'node:http';
import { app } from './app.js';
import { initSocket } from './sockets/index.js';
import { env, isAiEnabled } from './config/env.js';

const httpServer = createServer(app);
initSocket(httpServer);

httpServer.listen(env.port, () => {
  console.log(`BookLeaf API listening on http://localhost:${env.port}`);
  console.log(`AI integration: ${isAiEnabled ? `enabled (${env.geminiModel})` : 'disabled (no GEMINI_API_KEY set), running in fallback mode'}`);
});
