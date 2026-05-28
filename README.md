# Goodboy

**AI workspace orchestrator. Local-first. Provider-agnostic.**

You have a repo. You have a goal. You also have four CLIs open in four
windows, each holding a slightly different version of the same task. This
is the part that's missing in the middle.

A desktop app that owns the context once and hands it to whichever agent
you want to run next. Same goal, same memory, different model. Conversation,
plans, decisions, PR state, all of it stays in a local SQLite on your
machine. Your keys, your data, your bandwidth.

<img width="4036" height="2270" alt="Goodboy screenshot" src="https://github.com/user-attachments/assets/f669511b-c09d-472b-9f30-3dcc88b7ceae" />

## The honest pitch

Switching between `Claude`, `Codex`, `Cursor` and `Gemini` ten times a day
was eating my afternoons. Every new tab meant rebuilding the same mental
scratchpad from scratch. Eventually I got fed up and built this.

**Open source. Every feature included. No paywall, no telemetry, no account.**

## What's actually inside

- **A context the agents share.** Goal, decisions, last summary, open
  questions. A summarizer keeps it fresh after every turn, you can edit any
  field by hand when the agents get it wrong.
- **Provider swap mid-task, without amnesia.** Each turn is rebuilt from
  the shared context, never resumed from a vendor session. Drop Claude
  halfway, hand the same task to Cursor or Codex, watch it pick up clean.
- **Plans as artifacts, not transcript scrollback.** They show up in a Plans
  tab with a status, ready to hand off to the agent that implements them.
- **GitHub and Linear in the side panel.** Pull request state, CI, review
  threads still owed answers, the issues assigned to you back at the office.
  One click from where you're typing.
- **Workflows for the multi-step stuff.** Scout, plan, implement, verify.
  Each step a typed agent, all of them sharing one context.
- **One-click scripts** for the four commands you keep retyping in the
  terminal. No agent, no tokens, just a button.

## Providers

Bring your own subscription. The app drives the official CLIs locally, on
**your existing plan**, never on a metered API key.

| Provider               | CLI                                  | Subscription     |
| ---------------------- | ------------------------------------ | ---------------- |
| **Anthropic (Claude)** | `npm i -g @anthropic-ai/claude-code` | Claude Max / Pro |
| **Cursor**             | Cursor desktop app                   | Cursor Pro       |
| **OpenAI (Codex)**     | `npm i -g @openai/codex`             | ChatGPT Pro      |
| **Google (Gemini)**    | `npm i -g @google/gemini-cli`        | Google AI Pro    |

One connected CLI is enough to start. Full guide:
[docs/providers.md](./docs/providers.md).

## Run it

```bash
pnpm install

pnpm tauri:dev      # hot reload, fastest to iterate
pnpm tauri:build    # produces an installable binary in apps/desktop/src-tauri/target/release/bundle/
```

Needs **Node ≥ 20**, **pnpm ≥ 10**, and a working **Rust** toolchain (Tauri
shells out to `cargo`). Platform prereqs:
<https://v2.tauri.app/start/prerequisites/>.

Hacking on the app itself? The dev-loop notes live in
[apps/desktop/README.md](./apps/desktop/README.md).

## Help out

Try it. If something breaks, feels weird, or is missing, open an issue.
Half-formed thoughts welcome. Screenshots welcome. "This feels off" is a
perfectly valid bug report.

## Stack

**Tauri 2 · React 19 · TypeScript · Tailwind v4 · Zustand · SQLite**, in a
pnpm + Turborepo monorepo: `apps/desktop` plus `packages/{ui,core,db,types}`.

## More

- [VISION.md](./VISION.md): the why
- [DESIGN.md](./DESIGN.md): how it looks and behaves
- [ROADMAP.md](./ROADMAP.md): milestones and what shipped
- [CONVENTIONS.md](./CONVENTIONS.md) · [CLAUDE.md](./CLAUDE.md): contributor rules

## License

[MIT](./LICENSE) © Amin Khayam
