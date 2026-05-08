# kAY.am — Vision

## The problem

AI-assisted development today is wasteful. Every session starts from zero, context bloats fast, you pay for the same information twice, and switching between tasks means losing everything or cramming unrelated work into one giant thread.

There is no layer between you and the AI agents. No orchestration. No memory across sessions. No cost awareness. No structure.

## The mission

**Work better. Spend less. Ship faster. Stay in control.**

kAY.am is a local-first AI workspace orchestrator that sits between you and your AI agents. It doesn't replace your editor or your terminal — it commands them.

## Core concepts

### Sessions

A session is a container for a goal. Not a chat. Not a thread. A goal.

"Refactor authentication domain" is a session. Inside it, you declare phases — setup, planning, implementation, review — and each phase spawns its own agent with only the context it needs. The session holds the big picture. The agents do the work.

### Synthetic context

Agents don't inherit the full history. They receive a synthetic summary — just enough to act, nothing more. You decide what's shared. Context is a resource, not a dump.

### Provider routing & balance

Register your AI providers (Anthropic, OpenAI, Cursor, etc.). Set priorities. Set budgets. kAY.am routes work to the right provider automatically.

- Provider 1 hits 75% budget → fallback to provider 2.
- Quick task → fast cheap model. Complex architecture → best available model.
- You see the spend in real time. No surprises at end of month.

### Telemetry & cost awareness

Every interaction is metered. kAY.am gives you total visibility on what you're spending and where, in real time.

- **Token usage**: input/output tokens per request, per session, per provider, per model.
- **Estimated cost**: live cost estimate based on provider pricing, with running totals per session.
- **Session lifecycle metrics**: when a session starts, when it resets, when it hits a threshold, when it switches provider, when it ends.
- **Budgets**: per-provider monthly cap, per-session soft cap. Visual alerts before you hit limits.
- **Historical view**: spend over time, broken down by provider, model, task type, session.
- **Provider efficiency**: compare cost-per-task across providers to inform routing rules.

All metrics are computed and stored locally. Nothing transmitted.

### Skills & automation

Your local skills, scripts, and workflows — packaged and reusable. One click to run a code review, scaffold a feature, run a migration checklist. Not locked into any single AI provider's ecosystem.

### Editor integration

kAY.am is the brain. VS Code is the hands. When it's time to write code, kAY.am opens your editor on the right worktree, in the right branch, with the right context. When the code is done, control returns to kAY.am.

## What kAY.am is NOT

- Not an IDE. You already have one.
- Not another chat UI. The world has enough.
- Not a wrapper around one AI provider. It orchestrates all of them.
- Not a cloud service. It runs on your machine, your data stays local.
- Not a data collector. We are a third party that connects you to providers — nothing more.

## Zero data ownership

kAY.am is a pure orchestration layer. We do not run servers. We do not have accounts. We do not store, log, or transmit your data anywhere except to the AI providers you choose.

- No backend. Ever.
- No telemetry. No analytics. No tracking.
- API keys stay on your machine, in your OS credential store.
- Conversations, prompts, and responses flow directly between you and the provider.
- The only local persistence is your own configuration: providers, thresholds, workspace structure, skills.

If kAY.am disappeared tomorrow, your data would be untouched — because it was never ours.

## Principles

1. **Context is expensive** — never send more than needed.
2. **Sessions are goals, not threads** — structure work by intent, not by time.
3. **Automate the repeatable** — if you did it twice, make it a skill.
4. **Provider agnostic** — no lock-in, ever.
5. **Local first, local only** — your machine, your keys, your data, full stop.
