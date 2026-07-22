# PawClaw

A privacy-minded, extensible desktop pet for OpenClaw that reacts to agent activity and keeps chat close at hand.

Built with Electron, React and TypeScript as an npm workspace monorepo.

## Requirements

- Node.js 22 or newer
- npm 10 or newer

## Setup

```sh
npm install
npm run check
npm run dev
```

## Commands

- `npm run dev` builds the monorepo and starts the Electron app.
- `npm run build` builds every package and the desktop renderer/main process.
- `npm run typecheck` checks all workspaces without emitting files.
- `npm test` builds the packages and runs the unit tests.
- `npm run validate:pets` validates every pet manifest and its entry asset.
- `npm run check` runs type checking, tests and pet validation.

## Project status

The desktop shell, pet state engine, plugin manifest validation and IPC boundary are scaffolded. The OpenClaw gateway transport and durable persistence adapters are intentionally still placeholders; the UI reports that state instead of simulating a connection.
