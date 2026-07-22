# PawClaw 🐾

**Give your OpenClaw agent a little life on your desktop.**

PawClaw is a local, privacy-minded desktop companion for [OpenClaw](https://openclaw.ai). It lives in its own transparent window, reacts while your agent works, and opens a focused chat whenever you want to talk.

<p align="center">
  <img src="pets/sol/preview.png" width="160" alt="Sol, PawClaw's animated cat companion">
</p>

> Meet **Sol** — technically the sun, visually a very committed orange cat.

## What it does

- **A companion that reacts.** Sol changes animation when OpenClaw is idle, thinking, replying, busy, offline, or celebrating.
- **A real OpenClaw chat.** Open a desktop chat window, send messages through the local Gateway, and pick up the existing conversation history.
- **Local by design.** PawClaw connects directly to your local OpenClaw Gateway. The Gateway token remains in Electron's main process and is never exposed to the renderer.
- **Pixel-art pets.** Pets are manifest-based, so adding a character does not require changing the application. Sol ships with idle, walk, sleep, think, talk, celebrate, and alert animations.
- **Built to extend.** Electron + React + TypeScript in a small npm-workspace monorepo, with a separate pet engine and SDK.

## Quick start

### Prerequisites

- Node.js 22+
- npm 10+
- A running local [OpenClaw Gateway](https://openclaw.ai)

### Run it

```bash
git clone https://github.com/Gui-Tora/pawclaw.git
cd pawclaw
npm install
npm run dev
```

PawClaw uses `ws://127.0.0.1:18789` and the main OpenClaw session by default. It reads the Gateway token from `OPENCLAW_GATEWAY_TOKEN` or your local OpenClaw configuration. You can override the defaults with:

```powershell
$env:OPENCLAW_GATEWAY_URL = "ws://127.0.0.1:18789"
$env:PAWCLAW_SESSION_KEY = "agent:main:main"
npm run dev
```

## How to use it

1. Start your OpenClaw Gateway.
2. Run PawClaw.
3. Double-click Sol to open the chat.
4. Talk to your agent — PawClaw keeps the conversation history in sync and Sol reacts to the agent's state.

## Development

```bash
npm run check       # build packages, typecheck, test, validate pets
npm run build       # build all packages and the Electron app
npm test            # run unit tests
npm run validate:pets
```

## Creating a pet

Every pet lives under `pets/<id>/` and is defined by a `pet.json` manifest, a preview image, and horizontal PNG spritesheets. Only `idle` is required. The optional states are `walk`, `sleep`, `think`, `talk`, `celebrate`, and `alert`; absent states gracefully fall back to idle.

```
pets/my-pet/
├── pet.json
├── preview.png
└── sprites/
    ├── idle.png
    ├── think.png
    └── talk.png
```

See [pets/README.md](pets/README.md) for the manifest and spritesheet format. Run `npm run validate:pets` before committing a new pet.

## Project status

PawClaw is an early work in progress, but the core loop is already usable: animated desktop pet, local Gateway connection, state-driven reactions, and synced desktop chat history. Expect the UI, settings, packaging, and pet ecosystem to grow from here.

## Credits

The Ember example pet uses Originum's free Comodo Dragon pack; see [THIRD_PARTY_ASSETS.md](THIRD_PARTY_ASSETS.md) for attribution and import instructions.

---

Built by [Gui-Tora](https://github.com/Gui-Tora) for people who prefer their agents to feel a little less invisible.
