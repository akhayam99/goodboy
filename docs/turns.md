# Turns

> **Read this when** changing what happens between a sent message and its
> recorded outcome: where a turn runs, which provider and model it runs on,
> how the CLI is spawned and read, what a turn event means, how a failure
> falls back, or the session summarizer that follows. **Not for** installing or
> connecting a provider CLI ([providers.md](providers.md)), how a workflow run
> advances ([workflows.md](workflows.md)), or mount lifecycle
> ([mounts.md](mounts.md)).

Owns the turn pipeline. The frontend drives it from
`apps/desktop/src/store/slices/turn/sendTurn.ts`, reads the stream in
`apps/desktop/src/features/chat/turn.ts`, and the Rust shell spawns the CLI in
`apps/desktop/src-tauri/src/turn.rs`. Per-provider stream parsers live in
`packages/core/src/providers/`.

## Where a turn writes

- A turn writes into the mount it was aimed at, else the session's active
  mount, else the scratch folder ([mounts.md](mounts.md#where-a-session-writes)).
  The destination is resolved when the turn starts and recorded as the
  agent's write destination, so the place the user sees is the place the turn
  writes.
- A queued turn freezes the mount id, path and revision it was queued on. If
  the mount moved or changed revision before the turn starts, the turn refuses
  instead of writing somewhere else.
- A resolver turn takes the worktree writer lease before it spawns. A denied
  lease queues it as a resolve attempt rather than running two writers in one
  worktree. The lease is bound to the child process in Rust and released when
  that process exits.
- A turn in a folder project captures a recoverable file version before and
  after it runs.

## Which provider and model

The route is resolved once per turn, in this precedence: a fallback retry, a
model the user explicitly picked for this turn, the workflow node's routing,
the turn override, then the agent's own pin. `resolveProviderForTurn` then
applies budget caps and cooldowns. When every provider is over its cap the turn
does not start and says so; when budget moved it to another provider, the
transcript carries a notice. A turn that ran on anything other than the model
the user picked raises a warning notification naming both. A disconnected
provider with no bound API key stops the turn with a connect prompt instead of
spawning.

The route that actually ran is recorded per run in `runRouting`, keyed by agent
and run id, the moment the run id exists. `executedAgentRouting` reads an
agent's newest run from its turn telemetry and falls back to that live record,
so the agent's chip names the model that is running before any usage lands.
The live record is memory only and is evicted with the agent.

## What the prompt carries

- The system prompt is the guards (write scope, session language, connected
  integrations, workspace profile) followed by the agent kind's own prompt.
  Claude receives it as an appended system prompt; every other CLI receives it
  at the top of the prompt, with the kind prompt fenced as a role boundary.
- A workflow step's first turn carries its predecessors' handoff summaries and
  the step prompt, and emits a `step_transition` event flagged `degraded` when
  the handoff it inherited was a fallback summary.
- The session's context slots are prepended, filtered by what the agent kind
  reads.
- A turn estimated at 85% or more of the model's context window raises a
  warning before it spawns.

Claude and the opencode family resume the provider's own session when the
agent's stored session belongs to the same provider. Cursor, Codex and
Antigravity instead receive a bounded block of prior turns. A mount
continuation never resumes, because it runs in another directory.

## Spawning the CLI

`turn_spawn` builds the argument list per CLI; the per-provider flags are
[providers.md](providers.md)'s. What holds for every spawn:

- **Secrets travel by environment, never argv.** A bound API key is read from
  the keychain into the one variable its provider expects; the workspace's
  GitHub connection becomes `GH_TOKEN` and `GITHUB_TOKEN`; the bridge variables
  are injected per [query-bridge.md](query-bridge.md).
- **The child is a clean process.** It takes PATH only
  ([architecture.md](architecture.md#subprocess-environment)), the variables a
  parent Claude session would leak are removed, and it runs in its own process
  group, so cancelling a turn stops everything it started.
- **Write scope is explicit.** The writable mounts and their git common
  directories are handed to the CLIs that accept extra directories, plus the
  bridge socket directory only while the bridge is serving. Claude loads only
  project and local settings, and MCP tools are always disallowed.
- **stderr drains on its own thread.** A CLI that fills the stderr pipe
  mid-stream would otherwise block stdout and hang the turn.
- Each stdout line is emitted as a `turn_event`, capped per line, followed by
  one end envelope carrying the exit code and stderr.

## Reading the stream

`createJsonLineAssembler` rejoins lines the CLI split, and one pure parser per
provider turns each line into `TurnEvent`s. A payload no parser models becomes
`unknown_payload` and is kept, never dropped.

- A usage-limit error ends the turn as a failure the moment it arrives.
- A CLI that exits without a single event fails with its non-JSON stdout and
  stderr, or with "exited without a response" when both are empty. One that
  produced events but no response and exited non-zero fails the same way.
- A turn that ends with no assistant text and no error appends a
  non-retryable "exited without a response" error.

## Turn events

`TurnEvent` and `ProviderUsage` live in `@goodboy/types`, so the core parsers
and the desktop app share them without depending on each other. Arms with
behavior beyond rendering:

- `permission_request` puts the run into `TurnState` `blocked` until a decision
  lands.
- `permission_decision` carries the chosen `PermissionScope`, which decides
  whether a retry is offered: an `allow` at session scope or wider is, a
  one-use approval is not, because it cannot carry into a new run.
- `step_transition` reports a workflow run advancing, with the context it
  carried forward.
- `error` carries `retryable`; only a retryable error offers Retry in the
  transcript.
- `provider_session_init` records the provider's own session id, which later
  turns resume from.
- `unknown_payload` keeps provider output the parsers do not model yet,
  counted per provider and payload type.

## Context measurement

Usage events feed telemetry and the context meter. Codex reports token totals
for the whole turn rather than what the context window holds, so after each
Codex usage event `codexMeasuredUsage` asks Rust for the thread's rollout file
under `$CODEX_HOME/sessions` (default `~/.codex`) and takes the latest
`last_token_usage` as the context size. When the rollout cannot be read, the
parsed usage stands.

## Failure and fallback

`classifyProviderError` names the failure. A usage limit puts the provider on
cooldown until its reset. `planTurnFallback` then plans at most two fallback
attempts; an unclassified failure or a cancelled turn never falls back.

- The first attempt prefers the role's configured fallback, unless the failure
  is a usage limit on that same provider.
- A usage limit or an authentication failure moves to another provider at the
  same cost tier.
- An unreachable provider is retried once on the same model.
- A rate limit steps down a tier on the same provider.
- An unavailable model or an outdated CLI tries a sibling model on the same
  provider.
- Anything else moves to another provider. Candidates are connected, enabled
  for the session and not cooling down.

A fallback marks the failed run, posts the original error plus a notice naming
the move, and reruns the same input on the same mount target. A usage limit
with no fallback notifies, and when the provider names its reset time it
schedules one retry on the same model at that time. Any other failure leaves
the agent in `error` with a retryable error event.

## After a turn succeeds

The run is marked succeeded, then: a project the turn asked to mount is
mounted, a workflow agent completes its step (`completeResolvedAgent`, which
may auto-advance the run), context slots and open questions are refreshed from
the turn, the assistant message is stored, the session summarizer is queued,
artifacts are captured (a capture that fails emits `artifact_capture_failed`),
nudges fire, and drift from the agent kind's role raises a notification.

Whatever the outcome, a turn that forked a mount hands off to one continuation
turn on the new mount once it ends.

## The session summarizer

After each successful turn the session summarizer condenses what happened into
the session's context slots, which the next turn reads as its preamble. It is
the chat's handoff, as the post-step summarizer is a workflow's
([workflows.md](workflows.md#the-post-step-summarizer)).

- One summarization runs per session, and at most one waits: a newer turn
  replaces the waiting one. It runs when the app is idle.
- It runs on the summarizer task model, routed around cooldowns. When every
  candidate is cooling down it pauses and offers a retry.
- Slot writes are compare-and-set against the snapshot it read. A slot the
  user changed meanwhile is never overwritten; the summarizer runs again on
  the new value. A slot that comes back over twice its budget gets one more
  pass.
- An unparseable answer retries once. A usage, authentication or rate limit
  cools that provider and falls back to another task model. Anything else
  sets the error state and offers a retry. The turn itself never fails because
  its summary did.
- Its spend is recorded as summarizer telemetry, apart from turn spend.

A workflow agent's own handoff (`summarizeAgentOutput`) runs once per agent at
a time with a 90 second timeout, and a failure falls back to the deterministic
summary flagged `degraded`.
