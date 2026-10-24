# Tether

A side-panel extension for people with executive dysfunction, ADHD or burnout. It shows one small step at a time. If you leave the tab or go quiet, it asks whether you're stuck or taking a break. If you're stuck, a small model on your own computer sorts the blocker and puts one tiny step in front of your task.

Nothing you type leaves your computer, and there's nothing to pay for.

## Install

1. Install [Ollama](https://ollama.com) and keep it running. On Linux, if it isn't running: `systemctl start ollama`.
2. In a terminal, run `ollama pull llama3.2:3b`. It's about 2 GB, once.
3. Download the latest zip from [Releases](../../releases/latest) and unzip it somewhere you'll keep it. Chrome reads the extension from that folder.
4. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and pick the folder.
5. Pin Tether, then click its icon to open the side panel.

It works in Chrome, Chromium, Brave and Edge. Tabs that were open before you installed it need a reload.

To update, download the new zip, replace the folder's contents, and press reload on Tether's card.

## Using it

Type the next small thing and press **Start**, or press **Break it down** to have the local model split a bigger goal into a few small steps. If the model can't, you get your goal as a single step.

If you're doing a step away from the screen, press **I'm on it**. Tether stops watching until you press **Done**.

If Tether nudges you while you're fine, press **Still working**. It waits twice as long before checking in again on that step, up to eight times as long.

## What Tether keeps

Your current steps, and whether you pressed **I'm on it**, are saved in this browser's local storage so they survive closing the panel. Finishing your last step clears them. Nothing else is stored, and nothing leaves your computer except the requests to Ollama on `127.0.0.1`.

## If something's off

Tether works without Ollama, with a simple suggestion when you say you're stuck. When you press "I'm stuck", it tells you in plain words if Ollama isn't running or the model hasn't been downloaded.

## Development

```bash
bun install
bun run dev         # rebuilds the extension as you edit; load extension/dist in Chrome
bun run test
bun run typecheck
```

`server/` is the same classifier as a small HTTP endpoint (`bun run dev:server`, then `POST /api/classify`). The extension doesn't need it.

### Checking the classifier

With Ollama running, this sends 30 labelled blockers through your local model and prints how often it picks the expected category:

```bash
bun run --filter @tether/shared eval
```

Set `OLLAMA_MODEL` to try another model, or `MIN_ACCURACY=0.8` to make it exit with an error below that. The cases are in `packages/shared/eval/blockers.json`; add your own.

### Publishing a release

```bash
git tag v0.1.0
git push origin main --tags
```

GitHub builds the extension and attaches `tether-v0.1.0.zip` to a new release.
