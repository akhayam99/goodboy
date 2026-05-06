# kAY.am

**AI workspace orchestrator. Local-first. Provider-agnostic.**

kAY.am sits between you and your AI agents. It doesn't replace your editor or your terminal — it commands them.

Manage macro sessions. Route work across providers (Anthropic, OpenAI, Cursor, ...) based on priority and budget. Get real-time visibility on tokens and cost. Automate the repeatable with skills.

> **Status**: Early development. Not yet usable.

## Why

- AI sessions today are monolithic threads. Context bloats, costs blur, work blends together.
- Switching providers means switching tools. No layer compares them, balances them, or routes work intelligently.
- Local skills and workflows are locked into vendor ecosystems.

kAY.am is the missing orchestration layer.

## Principles

- **Local-first, local-only.** No backend. No telemetry. No data collection. Your machine, your keys, your data.
- **Provider-agnostic.** No lock-in.
- **Context is expensive.** Never send more than needed.
- **Sessions are goals, not threads.** Structure work by intent.
- **Automate the repeatable.**

See [VISION.md](./VISION.md) for the full product vision.

## Stack

- **Tauri 2** + **React 19** + **TypeScript 5** + **Vite 6**
- **Tailwind CSS v4** for styling
- **Zustand** for state
- **SQLite** for local persistence (config only — no conversation data)
- Monorepo: **pnpm workspaces** + **Turborepo**

## Project structure

```
kay-am/
├── apps/desktop/     # Tauri 2 desktop app
├── packages/
│   ├── ui/           # Shared React components
│   ├── core/         # Business logic
│   ├── db/           # SQLite schema + queries
│   └── types/        # Shared TypeScript types
└── scripts/
```

## Development

```bash
pnpm install
pnpm tauri:dev      # run desktop app in dev mode
pnpm typecheck
pnpm test
pnpm build
```

## Contributing

See [CONVENTIONS.md](./CONVENTIONS.md) for monorepo conventions and [CLAUDE.md](./CLAUDE.md) for project rules.

- Conventional commits (`type(scope): subject`).
- Branch protection on `main`. PR-only.
- All changes in English.

## License

[MIT](./LICENSE) © Amin Khayam
