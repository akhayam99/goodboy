# Goodboy: Vision

## The problem

The IDE was designed around the file. Everything it shows you, the tree, the tabs, the editor, the terminal, assumes the unit of work is a buffer of text. That was true when you wrote the code by hand.

It is not true anymore. The unit of work is now the task: fix this Sentry issue, ship this Linear ticket, address this review comment, land this PR. Code is what a task produces, not what a task is. Yet every tool still makes you start from the file and reconstruct the task in your head, gathering the issue, the thread, the diff, the review, the deploy, one browser tab at a time.

AI-assisted development made this worse, not better. Every session starts from zero, context bloats fast, you pay for the same information twice, and switching between tasks means losing everything or cramming unrelated work into one giant thread. There is no layer between you and the agents. No orchestration. No structured way to share learnings. No cost awareness. No plans beyond chat transcripts.

## The mission

**Work better. Spend less. Ship faster. Stay in control.**

Goodboy is the IDE of the next decade: a local-first workspace where the task is the primary object, the integrations that define the task are second, the code is third, and the chat is only the last mile. It does not replace your editor or your terminal. It commands them.

## The layer model

Four layers, in order of primacy. Reading top to bottom is how you work; reading bottom to top is how today's tools are built.

1. **Task.** The thing you are actually doing. It has an origin (an issue, an alert, a review comment, an idea), a goal, a budget, a state, and a definition of done. Goodboy treats the task as a first-class object with its own worktree, branch, context, and history.
2. **Integrations.** Where tasks come from and where they go back. GitHub, GitLab, Linear, Sentry today. The task is not complete when the code compiles, it is complete when the issue closes, the PR merges, the alert resolves. Integrations are not a side panel, they are the second layer of the product.
3. **Code.** The diff, the worktree, the branch, the checks. The artifact the task produces. Goodboy owns the isolation (one worktree per session) and hands editing to your editor.
4. **Chat.** The last mile. How you and the agents talk while the task moves. Necessary, but the least interesting layer, and the one every other tool mistakes for the whole product.

Every UI decision follows this order. A surface that shows chat before it shows the task is a surface built upside down.

## Company and workspaces

Above the workspace sits the **company**: the container for everything shared across projects. It is where the integrations that are not project-specific live, because they are not per-repository facts: Slack, Teams, Google Calendar, Meet, Jira. One connection, one identity, available to every workspace under it.

The company layer is not implemented yet. It is the direction: today a workspace connects its own integrations, tomorrow it inherits the company ones and only declares what is genuinely local to the project. Nothing in the current model should assume the workspace is the top of the tree.

Four nested layers:

- A **company** owns the shared integration surface and the people in it. Direction, not yet shipped.
- A **workspace** is the detail view of a project: a registered git repository plus the integrations specific to it (GitHub or GitLab for code review, Linear for planning, Sentry for production truth). It is the aggregator of every piece of work on that project, not just the sessions you opened today.
- A **session** is a container for a goal: its own git worktree, branch, budget, and shared context. Its stage (attention / running / review / building / done) is derived from what the session actually holds, never set by hand. "Refactor authentication domain" is a session.
- An **agent** is an independent chat thread inside a session. You spawn as many as you want, switch between them by clicking, and rename them inline. Each agent has its own provider, model, effort level, verbosity, and kind label.

A session always has at least one agent (auto-spawned at creation). Spawning more is free-form: no workflow required. When a workflow preset is attached, it pre-spawns one agent per step (e.g. scout, planner, implementer, reviewer), but those agents are then independent and live alongside any free agents you add later.

## Integration surface roadmap

The workspace is the aggregator of the project. That means every integration surface has to be readable inside Goodboy, not just linked out to a browser tab.

- **Shipped, workspace scope.** GitHub (PR state, checks, review decisions, comments, diff), GitLab (merge requests), Linear (issues), Sentry (issues and events).
- **In progress, workspace scope.** One page anatomy for every integration object instead of a hand-rolled scroll view per source: Linear issues, Sentry issues, GitHub issues and pull requests, and GitLab issues and merge requests all read through it, each driven by one ordered field set so the same fact lands in the same place on every page. Folding the compact cards onto that same field set is still ahead. Reading is done; acting is not. Comment, assign, transition, resolve are still a browser tab away, and those write paths are what closes the layer.
- **Later, company scope.** Slack and Teams for the conversation a task came out of, Google Calendar and Meet for the meeting it was decided in, Jira for the organizations that plan there.

The rule for every integration: share the layout, never the logic. A Sentry issue and a GitHub pull request look coherent side by side because the page anatomy is one primitive, not because we pretended their data models are the same. They are not.

## Core concepts

### Agent kinds

Ten role labels that shape how an agent works: **planner**, **scout**, **implementer**, **debugger**, **tester**, **reviewer**, **pr-reviewer**, **docs**, **resolver**, **generic** (displayed as "Generalist", badge `GEN`). Each kind carries default model, effort, and optional system prompt settings. Kind is inferred automatically from the agent's name or first user message, or chosen explicitly when the agent is spawned. Nine are pickable in the spawn menu; **resolver** is spawned only by the resolve UI.

### Workflows

A workflow is a reusable sequence of steps. Attach a preset from the sidebar, or assemble your own in a custom builder. A workflow can carry an optional goal, overridable per run.

- **Runs are instances.** Attaching a workflow starts a run; the same workflow can be re-run any number of times in a session, each run independent.
- **Trigger modes** decide when a run begins: run on attach (default), wait for a manual start, or chain after a predecessor run completes. A chained run waits for the one before it, then proceeds on its own.
- **Drafts survive session switches.** A workflow you're building in the editor is kept as you move between sessions, and cleared once you create or discard it.
- **Natural language drafts a workflow.** Describe what you want and Goodboy formats a draft of the steps, which you then edit before attaching.

### Shared context

Agents inside the same session do **not** share their conversation history. What they share is the **lens column**, a left rail that lists every view onto the session, grouped Context / Work / Infra / Integrations above a session Overview. Context holds the synthetic slots (goal, decisions, session summary) that the LLM auto-populates after every turn; you can also edit them by hand. Work holds what the session produces (workflows, agents, resolve, questions, diff, plans).

Each lens opens as the main view, rendered as markdown where it is prose, and slots maintain history. Chat is one destination among the lenses, not the frame around them: switching agents swaps the transcript, the lens column does not move, because it belongs to the session and not to the agent. This is the layer that lets independent agents collaborate on the same goal without cross-contaminating their threads.

Context is a resource, not a dump.

### Plans

Planner agents emit structured plans wrapped in `<<plan>>...<</plan>>` markers. These become first-class session artifacts, not buried in chat transcripts. Plans have lifecycle status (active / consumed / superseded) and are consumed by other agents who act on them. Consumption is tracked, and plans are viewable in a dedicated studio that renders them as a tree.

### Provider routing & balance

Register your AI providers (Anthropic, Cursor, Codex, Gemini, OpenCode, OpenRouter). Set priorities. Set budgets. Enable or disable providers per session. Goodboy routes work to the right provider automatically.

- Provider 1 hits 75% budget, fall back to provider 2.
- Quick task, fast cheap model. Complex architecture, best available model.
- Each workflow step picks its model automatically by role, tier, and cost; an explicit pin overrides the auto choice.
- You see the spend in real time. No surprises at end of month.

Routing is a fact about the work, so it reads like one. A model is shown as its provider mark, its authored name, and its effort, in that order, never as a raw catalog id.

### Telemetry & cost awareness

Every interaction is metered. Goodboy gives you total visibility on what you're spending and where, in real time.

- **Token usage**: input/output tokens per request, per session, per provider, per model.
- **Estimated cost**: live cost estimate based on provider pricing, with running totals per session.
- **Session lifecycle metrics**: when a session starts, resets, hits a threshold, switches provider, ends.
- **Budgets**: per-provider monthly cap, per-session soft cap. Visual alerts before you hit limits.

All metrics are computed and stored locally. Nothing transmitted.

### Skills & automation

Local skills live with the workspace: markdown files with frontmatter discovered from `<workspace>/.kay/skills/*.md` or `<workspace>/.claude/skills/<name>/SKILL.md`. Invoke from chat via `/skill-name`. Parsed by the skill registry, executable across any connected provider. Per-workspace, not global. Not locked into any single AI provider's ecosystem.

### Editor integration

Goodboy is the brain. Your editor is the hands. When it's time to write code, Goodboy opens your editor on the right worktree, in the right branch. VS Code and Cursor are detected automatically; when both are available, a dropdown lets you pick. When the code is done, control returns to Goodboy.

## What Goodboy is NOT

- Not a text editor. You already have one, and Goodboy drives it.
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

1. **The task is the unit of work**: files, threads, and diffs are what a task touches, not what it is.
2. **Context is expensive**: never send more than needed.
3. **Sessions are goals, not threads**: structure work by intent, not by time.
4. **Integrations are the product, not a panel**: work starts and ends outside the repo.
5. **Automate the repeatable**: if you did it twice, make it a skill.
6. **Provider agnostic**: no lock-in, ever.
7. **Local first, local only**: your machine, your keys, your data, full stop.
8. **Plans over chat**: structure intent as artifacts, not buried in transcripts.
