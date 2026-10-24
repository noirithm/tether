// Runs the labelled blockers through your local model and reports how often it agrees.
//   bun run --filter @tether/shared eval
// Optional: OLLAMA_MODEL=..., OLLAMA_URL=..., MIN_ACCURACY=0.8 (exit 1 below it)
import {
  BLOCKER_CATEGORIES,
  createOllamaClassifier,
  OLLAMA_MODEL,
  OLLAMA_URL,
  ollamaStatus,
  type BlockerCategory,
} from '../src';
import { CASES } from './cases';

const baseUrl = process.env.OLLAMA_URL || OLLAMA_URL;
const model = process.env.OLLAMA_MODEL || OLLAMA_MODEL;
const minAccuracy = Number(process.env.MIN_ACCURACY) || 0;
const MAX_STEP_WORDS = 20;

const status = await ollamaStatus({ baseUrl, model });
if (status !== 'ready') {
  console.error(
    status === 'unreachable'
      ? `Ollama is not reachable at ${baseUrl}. Start it and run this again.`
      : `The model ${model} is not installed. Run: ollama pull ${model}`,
  );
  process.exit(1);
}

const classify = createOllamaClassifier({ baseUrl, model });
const totals = new Map<BlockerCategory, { right: number; all: number }>(
  BLOCKER_CATEGORIES.map((category) => [category, { right: 0, all: 0 }]),
);
const misses: string[] = [];
let longSteps = 0;
let errors = 0;

console.log(`model ${model}, ${CASES.length} cases\n`);

for (const item of CASES) {
  const tally = totals.get(item.category);
  if (!tally) continue;
  tally.all += 1;
  try {
    const result = await classify(
      { currentTask: item.task, blocker: item.blocker },
      AbortSignal.timeout(60_000),
    );
    if (result.category === item.category) tally.right += 1;
    else misses.push(`  wanted ${item.category}, got ${result.category}: "${item.blocker}"`);
    if (result.suggested_micro_step.split(/\s+/).length > MAX_STEP_WORDS) longSteps += 1;
  } catch (error) {
    errors += 1;
    misses.push(`  error (${error instanceof Error ? error.message : error}): "${item.blocker}"`);
  }
}

let right = 0;
for (const [category, { right: ok, all }] of totals) {
  right += ok;
  console.log(`${category.padEnd(22)} ${ok}/${all}`);
}
const accuracy = right / CASES.length;
console.log(`\naccuracy ${(accuracy * 100).toFixed(0)}%, ${errors} errors, ${longSteps} steps over ${MAX_STEP_WORDS} words`);
if (misses.length > 0) console.log(`\nmisses:\n${misses.join('\n')}`);

process.exit(accuracy < minAccuracy || errors > 0 ? 1 : 0);
