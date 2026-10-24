import { afterEach, describe, expect, it } from 'bun:test';
import { ClassifierError } from './classifier';
import { createOllamaClassifier, createOllamaPlanner, ollamaStatus } from './ollama';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function stubFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) =>
    handler(String(input), init ?? {})) as unknown as typeof fetch;
}

function chatAnswer(content: unknown) {
  return Response.json({ message: { content: JSON.stringify(content) } });
}

describe('createOllamaClassifier', () => {
  it('asks for a constrained answer and parses it', async () => {
    let sent: Record<string, any> = {};
    stubFetch((url, init) => {
      expect(url).toBe('http://ollama.test/api/chat');
      sent = JSON.parse(String(init.body));
      return chatAnswer({ category: 'EXTERNAL_DEPENDENCY', suggested_micro_step: 'Send the nudge.' });
    });

    const classify = createOllamaClassifier({ baseUrl: 'http://ollama.test', model: 'tiny:1b' });
    const result = await classify({ currentTask: 'Ship it', blocker: 'waiting on Sam' });

    expect(result).toEqual({ category: 'EXTERNAL_DEPENDENCY', suggested_micro_step: 'Send the nudge.' });
    expect(sent.model).toBe('tiny:1b');
    expect(sent.stream).toBe(false);
    expect(sent.format.required).toEqual(['category', 'suggested_micro_step']);
    expect(sent.messages[0].role).toBe('system');
    expect(sent.messages[1].content).toBe('<task>Ship it</task>\n<blocker>waiting on Sam</blocker>');
  });

  it('throws when Ollama answers with an error status', async () => {
    stubFetch(() => new Response('nope', { status: 500 }));
    const classify = createOllamaClassifier();
    await expect(classify({ currentTask: 'a', blocker: 'b' })).rejects.toThrow(ClassifierError);
  });

  it('throws when the answer has no text', async () => {
    stubFetch(() => Response.json({ message: {} }));
    const classify = createOllamaClassifier();
    await expect(classify({ currentTask: 'a', blocker: 'b' })).rejects.toThrow('no text');
  });
});

describe('createOllamaPlanner', () => {
  it('sends the goal and returns the steps', async () => {
    let sent: Record<string, any> = {};
    stubFetch((_url, init) => {
      sent = JSON.parse(String(init.body));
      return chatAnswer({ steps: ['Open the document.', 'Type the title.'] });
    });

    const plan = createOllamaPlanner();
    expect(await plan({ goal: 'Write the report' })).toEqual([
      'Open the document.',
      'Type the title.',
    ]);
    expect(sent.messages[1].content).toBe('<goal>Write the report</goal>');
    expect(sent.format.required).toEqual(['steps']);
  });
});

describe('ollamaStatus', () => {
  const tags = (names: string[]) => Response.json({ models: names.map((name) => ({ name })) });

  it('is ready when the model is pulled', async () => {
    stubFetch(() => tags(['llama3.2:3b']));
    expect(await ollamaStatus()).toBe('ready');
  });

  it('notices a missing model', async () => {
    stubFetch(() => tags(['other:7b']));
    expect(await ollamaStatus()).toBe('missing_model');
  });

  it('treats an untagged model name as :latest', async () => {
    stubFetch(() => tags(['tiny:latest']));
    expect(await ollamaStatus({ model: 'tiny' })).toBe('ready');
  });

  it('is unreachable on a network error or a bad status', async () => {
    stubFetch(() => {
      throw new TypeError('connection refused');
    });
    expect(await ollamaStatus()).toBe('unreachable');

    stubFetch(() => new Response('', { status: 503 }));
    expect(await ollamaStatus()).toBe('unreachable');
  });
});
