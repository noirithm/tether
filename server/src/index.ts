import {
  createOllamaClassifier,
  OLLAMA_MODEL,
  OLLAMA_URL,
  ollamaStatus,
} from '@tether/shared';
import { createApp } from './app';

const port = Number(process.env.PORT) || 8787;
// loopback unless told otherwise, so the server isn't exposed to the local network
const hostname = process.env.HOST ?? '127.0.0.1';
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const ollama = {
  baseUrl: process.env.OLLAMA_URL || OLLAMA_URL,
  model: process.env.OLLAMA_MODEL || OLLAMA_MODEL,
};

const classify = createOllamaClassifier(ollama);
const app = createApp({ classify, status: () => ollamaStatus(ollama), allowedOrigins });

console.log(`tether server listening on http://${hostname}:${port}`);

const state = await ollamaStatus(ollama);
if (state === 'unreachable') {
  console.warn('Ollama is not running. Start it with: systemctl start ollama (or run: ollama serve)');
} else if (state === 'missing_model') {
  console.warn(`The model is not installed. Run: ollama pull ${ollama.model}`);
} else {
  console.log(`classifier: Ollama (${ollama.model})`);
  // load the model now so the first real request isn't the slow one
  classify({ currentTask: 'Warm up', blocker: 'Warm up' }).catch(() => {});
}

export default { port, hostname, fetch: app.fetch };
