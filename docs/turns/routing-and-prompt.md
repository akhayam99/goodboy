# Route and prompt

> **Read this when** you change which provider, model and effort a turn runs
> on, or what the prompt and system prompt carry. **Not for** an agent's first
> message ([handoffs.md](handoffs.md)) or the per-provider flags
> ([../providers.md](../providers.md)).

## Which provider and model

The route is resolved once per turn, in this precedence: a fallback retry, a
model the user explicitly picked for this turn, the workflow node's routing,
the turn override, then the agent's own pin. `resolveProviderForTurn` then
applies limits and cooldowns.

- When every provider is over its limit, the turn does not start and says so.
- When budget moved it to another provider, the transcript carries a notice.
- A turn that ran on anything other than the model the user picked raises a
  warning notification naming both.
- A disconnected provider with no bound API key stops the turn with a connect
  prompt instead of spawning.

`runRouting` records the route that ran per run (agent and run id) the moment
the run id exists: provider, model and the effort flag passed (null when
none). `executedAgentRouting` reads an agent's newest run from its telemetry
and falls back to that record, so the chip names the running model before any
usage lands. Telemetry has no effort, so effort always comes from
`runRouting`. The record is memory only and evicted with the agent; opening a
session seeds it from the turn spans (`seedRunRoutingFromSpans`), and a record
a live turn already wrote wins.

## What the prompt carries

`renderHandoff` (`@goodboy/core`) owns the stacking. From the composed message
out it adds the context slots, the child routing menu, the cluster boundary,
the goal attachments, the prior turns and the verbosity line, then places the
guards and the kind prompt per provider.

### History for a provider that keeps none

Claude and the opencode family resume the provider's own session when the
agent's stored session belongs to the same provider. A mount continuation
never resumes, because it runs in another directory.

Cursor, Codex and Gemini (`shouldReplayHistoryAsText` in `providerFlags.ts`)
get a block of prior turns (`buildPriorTurnsBlock`), capped at
`PRIOR_TURNS_BUDGET_TOKENS` (8,000 estimated tokens, `preamble.ts`) and walked
newest first.

- The first user message is always carried, shortened to a quarter of the
  budget when longer.
- A newest message that alone is over the budget is carried cut, ending with
  `[shortened: n characters left out]`.
- A gap in the middle reads `[n older turns left out]`.
- It returns `{ text, carried, leftOut, isShortened }`, never an empty block
  with nothing said.

When a turn moves to another provider, or starts a handoff agent, and something
was left out, `handoffNoticeMessage` adds a note: "Carried over: 6 turns, the
plan, 2 notes; left out: 14 older turns."

### The system prompt

The system prompt is the guards (write scope, session language, connected
integrations, workspace profile) then the agent kind's prompt. Claude receives
it as an appended system prompt. Every other CLI receives it at the top of the
prompt, with the kind prompt fenced as a role boundary.

The session-language guard quotes the operator's last message and, after a
reload, the first message the operator wrote (`sessionOwnWordsOf`, read from
the session's agents by `sessionTranscriptOf`), then the goal slot, then the
title only when the operator typed or edited it. A generated title never fixes
the language. It names the language ("Write every reply, question, suggestion and summary in
Italian.") when `detectSessionLanguage` reads one. It scores stopwords for en,
es, pt, fr and de after cutting code spans, paths and identifiers. Under 3
words, under 2 hits, under 15% hits or a winner less than 1.5 times the
runner-up gives no name, and the rule then names no language. The Auto prompt and the orchestrator brief name it the
same way. The Cursor parser holds a half-read "> Auto routed to ..." line
until it ends and emits it as its own `decision_note`, keeping the text around
it as it was.

### The write-scope guard

`buildScopeGuard` is where every agent learns how to get a branch.

- `mount fork` is the one way to make a branch or worktree for a session.
  `git worktree add`, `git checkout -b`, `git switch -c` and
  `git branch <name>` are forbidden, because Goodboy never sees what they make.
- A writing turn gets the rule once the bridge serves and a mount exists. A
  read-only role such as the planner gets the planning half: it names each new
  branch `<type>/<kebab-desc>` and leaves creation to the step that writes.
- A guard that names a worktree or mount forbids linking or copying
  `node_modules`, `.next`, `dist` or other build output from another folder. A
  missing dependency is installed without asking, with the lockfile's command
  (`pnpm install`, `yarn install`, `npm ci`, `bun install`), plus the repo's
  build step when typecheck needs a workspace library's dist. The agent asks
  only when there is no lockfile and no setup command.

### Context slots and role notes

The session's context slots are prepended, filtered by the role
(`ROLE_SLOTS` in `slotRouting.ts`, one entry per role, so a new role does not
compile without one). The role is the step's role, or the one the agent kind
maps to, and it also picks the profile fields. Active `session_context_items`
whose audience names the role follow as "notes for your role". Both are
resolved once per turn. A stored `context.roleMap` is ignored (see
[../versioning.md](../versioning.md), Retired state).

An Auto child of brief version 2 (`briefVersion` in the turn input, from
`request_json.briefVersion` of its delegation, see [../auto.md](../auto.md))
reads only the goal slot. `briefSlotsOf` replaces the role's slots, so the
decisions, open questions, files touched and session summary never reach it;
the profile, role instructions, scope rules, images and role notes stay. A turn
without the version (a hand started agent, an older delegation and its
retries and resumes) keeps the role's slots.

### Steps and size

- A workflow step's first turn carries its predecessors' handoff summaries and
  the step prompt. It emits `step_transition`, flagged `degraded` when the
  inherited handoff was a fallback summary. A fallback rerun does not emit it
  again, and the transcript shows one row for a transition repeated with only
  failure notices between.
- A turn estimated at 85% or more of the model's context window raises a
  warning before it spawns.

## Under the hood

- `scopeGuard.test.ts` pins the write-scope guard text.
- `store.handoff-sent-text.test.ts` pins the exact text sent for Claude and
  Codex.
