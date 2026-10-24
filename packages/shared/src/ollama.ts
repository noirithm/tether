import {
  ClassifierError,
  classificationSchema,
  parseClassification,
  SYSTEM_PROMPT,
  userMessage,
  type Classify,
} from './classifier';

export const OLLAMA_URL = 'http://127.0.0.1:11434';
export const OLLAMA_MODEL = 'llama3.2:3b';

interface Options {
  baseUrl?: string;
  model?: string;
}

export type OllamaStatus = 'ready' | 'missing_model' | 'unreachable';

// Runs on the user's own machine through Ollama: free, offline, and what people
// type about their blockers never leaves the computer.
export function createOllamaClassifier({
  baseUrl = OLLAMA_URL,
  model = OLLAMA_MODEL,
}: Options = {}): Classify {
  return async (request, signal) => {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal,
      body: JSON.stringify({
        model,
        stream: false,
        // keeps the model in memory between requests, since loading it is the slow part
        keep_alive: '30m',
        // Ollama constrains the answer to this schema
        format: classificationSchema,
        options: { temperature: 0, num_predict: 150 },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage(request) },
        ],
      }),
    });
    if (!res.ok) throw new ClassifierError(`ollama answered with status ${res.status}`);

    const data = (await res.json()) as { message?: { content?: unknown } };
    const content = data.message?.content;
    if (typeof content !== 'string') throw new ClassifierError('no text in the answer');

    return parseClassification(content);
  };
}

// is Ollama running, and has the model been pulled?
export async function ollamaStatus({
  baseUrl = OLLAMA_URL,
  model = OLLAMA_MODEL,
}: Options = {}): Promise<OllamaStatus> {
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(1_500) });
    if (!res.ok) return 'unreachable';

    const { models = [] } = (await res.json()) as { models?: { name?: string }[] };
    const wanted = model.includes(':') ? model : `${model}:latest`;
    return models.some((entry) => entry.name === wanted) ? 'ready' : 'missing_model';
  } catch {
    return 'unreachable';
  }
}
