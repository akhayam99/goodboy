# Concepts

> **Read this when** you need what a Goodboy object actually is: an agent
> kind, a workflow run, a lens, a plan, a resolver, a permission rule, or how
> far an integration goes. **Not for** the code that implements them
> (`docs/architecture.md`) or how a surface should look (`DESIGN.md`).

What the app does today, defined once. Every other document links here rather
than restating a definition.

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
- **Slack.** Threads read and replied to (replies post as the connected bot),
  routed into sessions with the goal pre-filled. The connection is per
  workspace; public bot-joined channels only, and no call has run against a
  live workspace yet, only contract tests.

The rule for every integration: share the layout, never the logic. A Sentry
issue and a GitHub pull request look coherent side by side because the page
anatomy is one primitive, not because we pretended their data models are the
same. They are not.

## Core concepts

### Agent kinds

Ten role labels that shape how an agent works: **planner**, **scout**,
**implementer**, **debugger**, **tester**, **reviewer**, **pr-reviewer**,
**docs**, **resolver**, **generic** (displayed as "Generalist", badge `GEN`).
Each kind carries default model, effort, and optional system prompt settings.
Kind is inferred automatically from the agent's name or first user message, or
chosen explicitly when the agent is spawned. Nine are pickable in the spawn
menu; **resolver** is spawned only by the resolve UI.

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
Overview. Context holds the synthetic slots (goal, decisions, session summary)
that the LLM auto-populates after every turn; you can also edit them by hand.
Work holds what the session produces (workflows, agents, resolve, questions,
diff, plans).

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

Register your AI providers (Anthropic, Cursor, Codex, Antigravity, OpenCode,
OpenRouter, Moonshot). Set priorities. Set budgets. Enable or disable
providers per session. Goodboy routes work to the right provider
automatically.

- Provider 1 passes its budget threshold, work moves to provider 2. You pick the
  threshold; it defaults to 80% of the cap.
- Quick task, fast cheap model. Complex architecture, best available model.
- Each workflow step picks its model automatically by role, tier, and cost; an
  explicit pin overrides the auto choice.
- You see the spend in real time. No surprises at end of month.

Routing is a fact about the work, so it reads like one. A model is shown as
its provider mark, its authored name, and its effort, in that order, never as
a raw catalog id.

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
