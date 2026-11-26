# Usage limits, room and spend

> **Read this when** you change how usage windows, Codex free resets, spend
> against a budget, or a provider's room are read.
> **Not for** what the Usage group shows ([provider-page.md](provider-page.md))
> or how routing uses the room ([routing.md](routing.md)).

Goodboy asks each provider's own CLI for your usage, the way you would. It never
reads your sign-in: the CLI uses its own stored credentials, and Goodboy only
spawns it and reads what it prints. Antigravity, Copilot and Cursor report nothing
Goodboy can read.

## Claude

Two sources; the newest observation wins per window.

- **Probe** (`usage_probe.rs`, `claude_usage_probe`): a free, read-only spawn of
  `claude -p "/usage" --output-format json --setting-sources project,local --no-session-persistence`
  in an empty scratch directory, 15 s timeout. It is not a turn: it never goes
  through `sendTurn`, telemetry or spend. `useProviderLimitsProbe` runs it at boot,
  every 15 minutes, and on the next focus once 15 minutes have passed
- `parseClaudeUsageText` reads lines like
  `Current session: 4% used · resets Sep 26 at 7:40am (Europe/Rome)`. The
  percentage is the only ground truth. The reset uses the timezone in parentheses;
  a reset it cannot parse gives no `resetsAt`, and an unknown line is skipped
- **Turn**: `claude -p` emits `rate_limit_event` lines. `parseStreamJsonLine` hands
  them to `ctx.onProviderLimits`, out of the transcript. Each carries
  `rate_limit_info.unifiedWindows` with `five_hour` and `seven_day`
  (`utilization` 0 to 1, `resetsAt` in epoch seconds)
- `rateLimitType` names the limiting window and its `status` (`allowed`,
  `allowed_warning`, `rejected`); a per-model type adds its own window. An unknown
  type drops only its window. `mergeProviderLimits` keeps windows until their reset

## Codex

Asked at boot, every 15 minutes and after every Codex usage event.
`refreshCodexLimits` reads the rollout files first, and asks the app server only
when that reading is missing, invalid or older than five minutes.

- **Rollout**: `token_count` lines under `$CODEX_HOME/sessions` carry
  `payload.rate_limits` (snake case, plus `plan_type`). `codex_rate_limits_latest`
  in `codex_rollout.rs` reads the newest reading among the five newest rollouts,
  so it sees Codex use outside Goodboy too. A reading with neither window is
  skipped: Codex writes an empty `premium` bucket after the real `codex` one
- **App server** (`codex_app_server.rs`, `codex_rate_limits_probe`): spawns
  `codex app-server` on stdio in an empty scratch directory, sends `initialize`,
  `initialized` and `account/rateLimits/read`, reads JSON lines until the answer or
  15 s, then kills it. Zero tokens. Checked against codex 0.156.0 and its
  `generate-json-schema` output; it is marked experimental, so a failure keeps the
  rollout reading
- `parseCodexAppServerLimits` takes the `codex` bucket of `rateLimitsByLimitId`
  (or `rateLimits`): `primary` is 5 hours, `secondary` the week, `planType` the plan
- `parseCodexResetCredits` reads `rateLimitResetCredits` (count, first credit's id
  and expiry) into `codexResetCredits`. Background polls pass
  `excludeResetCreditDetails`, and keep the details they had while the count holds

`providerLimitsProbe` keeps, per provider, whether a probe runs, when one last
worked and how many failed in a row.

## Storage and the probe lock

- The last observation per provider lives in `provider_limits` (m176) and the
  `providerLimits` slice. A write never replaces a newer observation
- `packages/core/src/providers/limits/constants.ts` holds the thresholds: warning
  from 80%, old data after 30 minutes
- The probe lock (`store/slices/providers/probeLock.ts`) allows one status, usage,
  limits or connection test per provider. Same-kind calls join; other kinds wait.
  Automatic checks skip a provider with a live agent turn, and **Check again**
  waits for it. Each window owns its queue and history

## Codex free resets

1. Usage shows the reset with its expiry and **Use reset**; the confirm opens in
   place of the row
2. With half the week or more left, or a refill within a day, the confirm is a
   strong stop: **Save reset for later** is the default, and **Use reset anyway**
   stays off until you tick that you understand
3. Goodboy sends `account/rateLimitResetCredit/consume` to `codex app-server`
   (`codex_consume_reset_credit`) with one attempt key, kept in `codexPendingReset`
   until Codex answers, so **Retry** after a network error can never spend two
4. Goodboy reads the limits again

Claude's free resets only work on claude.ai or in Claude Desktop, so a full Claude
window shows **Open Claude usage**. Goodboy never buys a reset.

## Spent in Goodboy

Today, the last 7 days and this month across all workspaces, at API prices, and
the provider's budget when set. On a plan it is what the tokens would cost on the
API, not what you pay.

- `provider_budget_overview` (`src-tauri/src/budget.rs`) answers it in one call
- The budget month follows your local calendar and resets at local midnight on the
  1st. The app sends its UTC offset, and `SpendClock`
  (`src-tauri/src/budget/standing.rs`) is the only place that turns it into a window
- `classify_spend` there decides clear, near or over; spend equal to the cap is over
- Routing, the provider page, Impact and the chat pill read the same
  `check_provider_budget` status. **Open in Impact** edits the budget

## Room, load and strikes

Facts for routing, never guards.

- **Room**: `providerRoom` gives a used share, measured from a fresh reading or a
  capped budget, else estimated. The estimate starts at 50%, loses 2 points per
  clean turn in 5 hours (down to 30%), gains 10 per agent in the last hour, and goes
  to 85% or more after a rate limit in the last hour. It stops at 95%, so only a
  cooldown or a measured limit removes a provider
- **Load**: `providerLoad` counts agents, not turns: running ones plus those that
  closed a turn in the window, once each. `listProviderAgentTurns` reads
  `agent_turn_spans`. Windows: `ROOM_RECENT_WINDOW_MS` (1 hour) and
  `ROOM_TURNS_WINDOW_MS` (5 hours)
- **Strikes**: a rate limit failure (429) records its time in `providerStrikes`
  (`withProviderStrike`) and still falls back. A usage limit sets a cooldown
  instead. Strikes live in the window's store only, so another window and a restart
  forget them, which is why the room is an estimate
