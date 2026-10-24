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

### Publishing a release

```bash
git tag v0.1.0
git push origin main --tags
```

GitHub builds the extension and attaches `tether-v0.1.0.zip` to a new release.
