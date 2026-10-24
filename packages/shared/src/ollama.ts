import {
  ClassifierError,
  classificationSchema,
  parseClassification,
  SYSTEM_PROMPT,
  userMessage,
  type Classify,
} from './classifier';
import {
  parsePlan,
  PLAN_SYSTEM_PROMPT,
  planSchema,
  planUserMessage,
  type Plan,
} from './planner';

export const OLLAMA_URL = 'http://127.0.0.1:11434';
export const OLLAMA_MODEL = 'llama3.2:3b';

interface Options {
  baseUrl?: string;
  model?: string;
}

export type OllamaStatus = 'ready' | 'missing_model' | 'unreachable';

interface JsonChat {
  baseUrl: string;
  model: string;
  system: string;
  user: string;
  // Ollama constrains the answer to this schema
  schema: object;
  maxTokens: number;
}

// One structured chat call. Returns the JSON text the model wrote; the caller checks it.
async function chatJson(
  { baseUrl, model, system, user, schema, maxTokens }: JsonChat,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal,
    body: JSON.stringify({
      model,
      stream: false,
      // keeps the model in memory between requests, since loading it is the slow part
      keep_alive: '30m',
      format: schema,
      options: { temperature: 0, num_predict: maxTokens },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok) throw new ClassifierError(`ollama answered with status ${res.status}`);

  const data = (await res.json()) as { message?: { content?: unknown } };
  const content = data.message?.content;
  if (typeof content !== 'string') throw new ClassifierError('no text in the answer');
  return content;
}

// Runs on the user's own machine through Ollama: free, offline, and what people
// type about their blockers never leaves the computer.
export function createOllamaClassifier({
  baseUrl = OLLAMA_URL,
  model = OLLAMA_MODEL,
}: Options = {}): Classify {
  return async (request, signal) =>
    parseClassification(
      await chatJson(
        {
          baseUrl,
          model,
          system: SYSTEM_PROMPT,
          user: userMessage(request),
          schema: classificationSchema,
          maxTokens: 150,
        },
        signal,
      ),
    );
}

// breaks a goal into a few small steps, with the same local model
export function createOllamaPlanner({
  baseUrl = OLLAMA_URL,
  model = OLLAMA_MODEL,
}: Options = {}): Plan {
  return async (request, signal) =>
    parsePlan(
      await chatJson(
        {
          baseUrl,
          model,
          system: PLAN_SYSTEM_PROMPT,
          user: planUserMessage(request),
          schema: planSchema,
          maxTokens: 400,
        },
        signal,
      ),
    );
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
