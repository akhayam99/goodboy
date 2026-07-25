# Goodboy: Vision

## The problem

AI-assisted development today is wasteful. Every session starts from zero, context bloats fast, you pay for the same information twice, and switching between tasks means losing everything or cramming unrelated work into one giant thread.

There is no layer between you and the AI agents. No orchestration. No structured way to share learnings between agents. No cost awareness. No plans beyond chat transcripts.

## The mission

**Work better. Spend less. Ship faster. Stay in control.**

Goodboy is a local-first AI workspace orchestrator that sits between you and your AI agents. It doesn't replace your editor or your terminal; it commands them.

## Core concepts

### Workspaces, sessions, agents

Three nested layers, each doing one thing:

- A **workspace** is a registered git repository. Sessions live inside it.
- A **session** is a container for a goal: its own git worktree, branch, budget, shared context, and lifecycle status (wip / waiting / blocked / done). "Refactor authentication domain" is a session.
- An **agent** is an independent chat thread inside a session. You spawn as many as you want, switch between them by clicking, and rename them inline. Each agent has its own provider, model, effort level, verbosity, and kind label.

A session always has at least one agent (auto-spawned at creation). Spawning more is free-form: no workflow required. When a workflow preset is attached, it pre-spawns one agent per step (e.g. scout → planner → implementer → reviewer), but those agents are then independent and live alongside any free agents you add later.

### Agent kinds

Ten role labels that shape how an agent works: **planner**, **scout**, **implementer**, **debugger**, **tester**, **reviewer**, **pr-reviewer**, **docs**, **resolver**, **generic**. Each kind carries default model, effort, and optional system prompt settings. Kind is inferred automatically from the agent's name or first user message, or chosen explicitly when the agent is spawned. Nine are pickable in the spawn menu; **resolver** is spawned only by the resolve UI.

### Workflows

A workflow is a reusable sequence of steps. Attach a preset from the sidebar, or assemble your own in a custom builder. A workflow can carry an optional goal, overridable per run.

- **Runs are instances.** Attaching a workflow starts a run; the same workflow can be re-run any number of times in a session, each run independent.
- **Trigger modes** decide when a run begins: run on attach (default), wait for a manual start, or chain after a predecessor run completes. A chained run waits for the one before it, then proceeds on its own.
- **Drafts survive session switches.** A workflow you're building in the editor is kept as you move between sessions, and cleared once you create or discard it.
- **Natural language drafts a workflow.** Describe what you want and Goodboy formats a draft of the steps, which you then edit before attaching.

### Shared context

Agents inside the same session do **not** share their conversation history. What they share is the **right panel**, the session's detail and work products alongside the context slots: synthetic slots (goal, files touched, decisions, open questions, last summary) that the LLM auto-populates after every turn. You can also edit slots by hand.

Slots are collapsible, rendered as markdown, and maintain history. Switching between agents swaps the central chat to that agent's transcript. The right panel doesn't move; it's the session's, not the agent's. This is the layer that lets independent agents collaborate on the same goal without cross-contaminating their threads.

Context is a resource, not a dump.

### Plans

Planner agents emit structured plans wrapped in `<<plan>>...<<plan>>` markers. These become first-class session artifacts, not buried in chat transcripts. Plans have lifecycle status (active / consumed / superseded) and are consumed by other agents who act on them. Consumption is tracked, and plans are viewable in a dedicated studio that renders them as a tree.

### Provider routing & balance

Register your AI providers (Anthropic, Cursor, Codex, Gemini). Set priorities. Set budgets. Enable or disable providers per session. Goodboy routes work to the right provider automatically.

- Provider 1 hits 75% budget → fallback to provider 2.
- Quick task → fast cheap model. Complex architecture → best available model.
- Each workflow step picks its model automatically by role, tier, and cost; an explicit pin overrides the auto choice.
- You see the spend in real time. No surprises at end of month.

### Telemetry & cost awareness

Every interaction is metered. Goodboy gives you total visibility on what you're spending and where, in real time.

- **Token usage**: input/output tokens per request, per session, per provider, per model.
- **Estimated cost**: live cost estimate based on provider pricing, with running totals per session.
- **Session lifecycle metrics**: when a session starts, resets, hits a threshold, switches provider, ends.
- **Budgets**: per-provider monthly cap, per-session soft cap. Visual alerts before you hit limits.

All metrics are computed and stored locally. Nothing transmitted.

### GitHub integration

Connect via `gh` CLI or personal access token. Goodboy surfaces your PR state (draft, open, approved, merged, closed) alongside CI checks, review decisions, and comments. The diff viewer shows file-level hunks with inline annotations. Reviewer agents can consume diff comments directly. The GitHub card auto-refreshes when an agent creates or updates a PR.

### Skills & automation

Local skills live with the workspace: markdown files with frontmatter discovered from `<workspace>/.kay/skills/*.md` or `<workspace>/.claude/skills/<name>/SKILL.md`. Invoke from chat via `/skill-name`. Parsed by the skill registry, executable across any connected provider. Per-workspace, not global. Not locked into any single AI provider's ecosystem.

### Editor integration

Goodboy is the brain. Your editor is the hands. When it's time to write code, Goodboy opens your editor on the right worktree, in the right branch. VS Code and Cursor are detected automatically; when both are available, a dropdown lets you pick. When the code is done, control returns to Goodboy.

## What Goodboy is NOT

- Not an IDE. You already have one.
- Not another chat UI. The world has enough.
- Not a wrapper around one AI provider. It orchestrates all of them.
- Not a cloud service. It runs on your machine, your data stays local.
- Not a data collector. Your data flows directly between you and your providers. Goodboy is the local layer in between.

## Zero data ownership

Goodboy is a pure orchestration layer. We do not run servers. We do not have accounts. We do not store, log, or transmit your data anywhere except to the AI providers you choose.

- No backend. Ever.
- No telemetry. No analytics. No tracking.
- API keys stay on your machine, in your OS credential store.
- Conversations, prompts, and responses flow directly between you and the provider.
- Local persistence is SQLite (`~/.goodboy/data.db`): workspaces, sessions, agents, messages, context slots, plans, telemetry, skills, settings. All yours, all local.

If Goodboy disappeared tomorrow, your data would be untouched, because it was never ours.

## Principles

1. **Context is expensive**: never send more than needed.
2. **Sessions are goals, not threads**: structure work by intent, not by time.
3. **Automate the repeatable**: if you did it twice, make it a skill.
4. **Provider agnostic**: no lock-in, ever.
5. **Local first, local only**: your machine, your keys, your data, full stop.
6. **Plans over chat**: structure intent as artifacts, not buried in transcripts.
