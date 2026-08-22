# Concepts

> **Read this when** you need what a Goodboy object actually is: an agent
> kind, a workflow run, a lens, a plan, a resolver, a permission rule, or how
> far an integration goes. **Not for** the code that implements them
> (`docs/architecture.md`) or how a surface should look (`DESIGN.md`).

What the app does today, defined once. Every other document links here rather
than restating a definition.

## The object model

Four nested things, and everything else hangs off them.

- A **workspace** is the detail view of a project plus the integrations
  specific to it. It aggregates every piece of work on that project, not just
  the sessions you opened today. A repo owns one project directory and gives
  each session a git worktree, a composite links repo workspaces so one
  session can span them, and a simple workspace is a standalone folder whose
  sessions use plain directories without git. Those are the three
  `WorkspaceKind` values (`'repo'`, `'composite'`, `'simple'`), and five
  different wordings name them, none shared with another: the type union
  itself; the workspace form (`WorkspaceLinkForm`), which presents them as
  **Single project**, **Multi project**, and **Standalone**; the onboarding
  wizard's connected-workspace chip, which labels them **Repository**,
  **Composite**, and **Standalone**; the same wizard's earlier audience step,
  which asks the question a different way, as **I write code** versus **I do
  not write code** (the second answer only ever offers Standalone); and
  `WorkspaceRow`, live in the workspace launcher and switcher, which renders
  a simple workspace's chip as the raw kind value, lowercase: **simple**,
  with no equivalent chip for the other two kinds.
- A **session** is a container for a goal: its own git worktree, branch,
  budget and shared context. Its stage (attention / running / review /
  building / done) is derived from what the session actually holds, never set
  by hand. "Refactor authentication domain" is a session.
- An **agent** is an independent chat thread inside a session. You spawn as
  many as you want, switch between them by clicking, and rename them inline.
  Each agent has its own provider, model, effort level, verbosity and kind.
- A **task** is the thing you are actually doing, and it is what the product
  is organized around. It has an origin (an issue, an alert, a review comment,
  an idea), a goal, a budget, a state and a definition of done. A task is not
  finished when the code compiles, it is finished when the issue closes, the
  PR merges, the alert resolves.

A session always has at least one agent, auto-spawned at creation. Spawning
more needs no workflow. Attaching a workflow preset pre-spawns one agent per
step, and those agents then live alongside any free agents you add.

A repo workspace must already have usable git state before a session can
create its worktree. **Goodboy never runs git init, never commits, never adds
a remote on your behalf.**

The order matters, and it is why the app looks the way it does: task first,
then the integrations a task comes from and returns to, then the code as the
artifact it produces, then chat as the last mile. Every surface follows that
order. One that shows chat before it shows the task is built upside down.

## Integration surface

The workspace is the aggregator of the project, so every integration surface
has to be readable inside Goodboy, not linked out to a browser tab.
"Integrated" has a fixed meaning here, and a mirror does not qualify:

- **See it**: the object rendered in full inside Goodboy, through the one
  shared page anatomy.
- **Act on it**: comment, reply, assign, transition, approve, merge, resolve,
  from the same screen.
- **Route it**: turn it into a session with the goal written and the branch
  named, and follow it back out when the work ships.

Where each connected source stands, honestly:

- **GitHub.** Pull requests read and acted on (approve, request changes,
  comment, reply, resolve threads, merge, close); issues read and commented.
- **GitLab.** Merge requests read and acted on (approve, state changes,
  comment, reply, resolve and reopen threads); issues read, commented and
  edited.
- **Bitbucket.** Pull requests end to end: description, diff, build statuses
  in plain language, review threads, and eight verbs (approve, revoke,
  request changes, withdraw, comment, reply, merge, decline). No issue
  tracking by design: Atlassian points issues at Jira and Goodboy follows.
- **Jira.** Issues read in full and acted on: comment, assign, transition,
  edit description. Cloud only, one project key per workspace, no sprints or
  boards yet.
- **Linear.** Issues read and routed, with two writes: the description and a
  comment. Assign and transition are still the open gap, because the state
  and team we read carry no id to send back. Linear is where the PM persona
  lives.
- **Sentry.** Issues and events read; no write path yet.
- **Slack.** Threads read and replied to (replies post as the connected user),
  routed into sessions with the goal pre-filled. The connection is per
  workspace; only the public channels the connected person has joined, and no
  call has run against a live workspace yet, only contract tests.

The rule for every integration: share the layout, never the logic. A Sentry
issue and a GitHub pull request look coherent side by side because the page
anatomy is one primitive, not because we pretended their data models are the
same. They are not.

## Core concepts

### Agent kinds

Ten agent kinds shape how an agent works. Every kind has a display label:
`planner` is **Plan**, `scout` is **Scout**, `implementer` is **Implement**,
`debugger` is **Debug**, `tester` is **Test**, `reviewer` is **Review**,
`pr-reviewer` is **PR reviewer**, `docs` is **Docs**, `resolver` is
**Resolve**, and `generic` is **Generalist**. Their compact badge labels are
separate, for example `generic` uses `gen`. Each kind carries default model,
effort, and optional system prompt settings.
Kind is inferred automatically from the agent's name or first user message, or
chosen explicitly when the agent is spawned. In a repo or composite
workspace, nine are pickable in the spawn menu; **resolver** is spawned only
by the resolve UI. A simple (standalone) workspace's spawn menu offers only
**generic**.

### Workflows

A workflow is a reusable sequence of steps. Attach a preset from the sidebar,
or assemble your own in a custom builder. A workflow can carry an optional
goal, overridable per run.

- **Runs are instances.** Attaching a workflow starts a run; the same workflow
  can be re-run any number of times in a session, each run independent.
- **Trigger modes** decide when a run begins: run on attach (default), wait
  for a manual start, or chain after a predecessor run completes. A chained
  run waits for the one before it, then proceeds on its own.
- **Drafts survive session switches.** A workflow you're building in the
  editor is kept as you move between sessions, and cleared once you create or
  discard it.
- **Natural language drafts a workflow.** Describe what you want and Goodboy
  formats a draft of the steps, which you then edit before attaching.

### Shared context

Agents inside the same session do **not** share their conversation history.
What they share is the **lens column**, a left rail that lists every view onto
the session, grouped Context / Work / Infra / Integrations above a session
Overview. Context opens one surface with three ordered regions: goal, decisions,
and session summary. The LLM auto-populates them after every turn; you can also
edit them by hand. Work holds what the session produces (workflows, agents,
resolve, questions, diff, plans).

Each lens opens as the main view, rendered as markdown where it is prose, and
slots maintain history. Chat is one destination among the lenses, not the
frame around them: switching agents swaps the transcript, the lens column does
not move, because it belongs to the session and not to the agent. This is the
layer that lets independent agents collaborate on the same goal without
cross-contaminating their threads.

Context is a resource, not a dump.

A **turn** is one user prompt and one agent response, including the streaming
events between them.

### Plans

Planner agents emit structured plans wrapped in `<<plan>>...<</plan>>`
markers. These become first-class session artifacts, not buried in chat
transcripts. Plans have lifecycle status (active / consumed / superseded) and
are consumed by other agents who act on them. Consumption is tracked, and
plans are viewable in a dedicated studio that renders them as a tree.

### Review resolution

A diff comment is a user's annotation on a line under review. A resolver is
the agent assigned to address one review or diff comment with a local commit,
never a push. Resolvers run serially on the session worktree so two fixes
cannot race over the same branch.

### Permission rules

A permission rule matches a tool and chooses allow, deny, or ask at global,
workspace, or session scope. Provider capability determines enforcement. A
denied headless call blocks the turn; approval is explicit and retryable.

### Provider routing & balance

Register your AI providers. `ProviderId` contains `anthropic`, `cursor`,
`codex`, `gemini`, `opencode`, `openrouter`, and `moonshot`; the provider
picker displays them as **Claude**, **Cursor**, **Codex**, **Gemini**,
**OpenCode**, **OpenRouter**, and **Moonshot**, respectively. Set priorities.
Set budgets. Enable or disable providers per session. Goodboy routes work to
the right provider automatically.

- Provider 1 passes its budget threshold, work moves to provider 2. You pick the
  threshold; it defaults to 80% of the cap.
- Quick task, fast cheap model. Complex architecture, best available model.
- Each workflow step picks its model automatically by role, tier, and cost; an
  explicit pin overrides the auto choice.
- You see the spend in real time. No surprises at end of month.

Routing is a fact about the work, so it reads like one, except in the agent
spawn menu itself. `AgentSpawnConfig` renders `RoutingPicker` directly.
`CreateAgentPopover` does not: it renders `AgentRoutingSections`, which
imports `RoutingPicker`'s `CatalogGrid` on its own instead of mounting
`RoutingPicker`. Either way, `CatalogGrid` groups each model's catalog entry
by `presentation.group` (**Haiku**, **Sonnet**, **Opus**, **Fable**, and the
equivalent per-provider groups) as a row label, except for ten models, across
Cursor, OpenCode, Moonshot and OpenRouter, whose `presentation.group` is
`null`; those render in one ungrouped row per family with no row label at
all. Each model then renders as a `VersionChip` showing its
`presentation.version` (**4.5**, **4.6**, **4.7**, **4.8**, **5**) as its
visible text, not bare. Neither the row label nor the chip carries a provider
mark or an effort value; effort is a separate control elsewhere in the
picker.

### Cost awareness

Every interaction is metered, locally. Goodboy gives you total visibility on
what you're spending and where, in real time.

- **Token usage**: input/output tokens per request, per session, per provider,
  per model.
- **Estimated cost**: live cost estimate based on provider pricing, with
  running totals per session.
- **Session lifecycle metrics**: when a session starts, resets, hits a
  threshold, switches provider, ends.
- **Budgets**: per-provider monthly cap, per-session soft cap. Visual alerts
  before you hit limits. Caps steer routing rather than lock you out: when
  every provider is over cap the composer says so and you can still send the
  turn on the provider you picked.

All metrics are computed and stored locally. Nothing transmitted.

### Skills & automation

Local skills live with the workspace: markdown files with frontmatter
discovered from `<workspace>/.kay/skills/*.md` or
`<workspace>/.claude/skills/<name>/SKILL.md`. Invoke from chat via
`/skill-name`. Parsed by the skill registry, executable across any connected
provider. Per-workspace, not global. Not locked into any single AI provider's
ecosystem.

### Editor integration

Goodboy is the brain. Your editor is the hands. When it's time to write code,
Goodboy opens your editor on the right worktree, in the right branch. VS Code
and Cursor are detected automatically; when both are available, a dropdown
lets you pick. When the code is done, control returns to Goodboy.
