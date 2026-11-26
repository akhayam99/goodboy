# Providers, spend and Impact

> **Read this when** you change where work goes between providers, how spend is
> counted against a limit, or what Impact keeps after a session goes away.
> **Not for** signing in to a provider ([../providers.md](../providers.md)) or
> how the model picker works ([../model-picker.md](../model-picker.md)).

## Providers and routing

Goodboy works with eight providers: **Claude**, **Cursor**, **Codex**,
**Gemini**, **Copilot**, **OpenCode**, **OpenRouter** and **Moonshot**. You set
their order and budgets and turn each on or off per session, and Goodboy decides
where each piece of work goes.

- A provider past its budget limit hands work to the next one. It warns at 80% of
  the limit you pick.
- Quick tasks go to fast, cheap models, hard design work to the best model you
  have.
- Each workflow step picks its model by role, level and cost, and a model you pin
  beats the automatic choice.

## What is measured

Goodboy measures every turn on your machine and sends nothing anywhere: token
usage per request, session, provider and model; a live cost estimate from
provider prices; session events (start, reset, limit, provider change, end); a
monthly budget per provider across all workspaces on your local calendar month;
and a per-session limit that pauses workflows or only warns.

- Only a session limit that pauses caps a Lead run; one that only warns caps
  nothing (`pausingSessionCapOf` in `apps/desktop/src/features/budget/`).
- **Spend and limit** on a session's menu opens it with its limit editor open
  (`openSessionSpendLimitEdit`).
- Every **Ask** answer is telemetry kind `ask` on its session (m227). It counts
  in the session cost, today's spend, provider budgets and the session limit
  alert, shows as its own **Ask** row, and never counts toward a run's limit,
  which sums only that run's agents.

Limits steer where work goes and never lock you out: when every provider is over
its limit, the message box says so, and you can still send on the provider you
picked.

## One owner per number

Every spend number on screen comes from `spendFigures`
(`features/budget/spendFigures.ts`), and each names its window: Impact its range
(7 days, 30 days or all time), the provider page this local calendar month (with
the limit, what is left and the reset date), the top bar chip today. A
provider, session or model row sums its own records through `totalUsd` in the
same file. The overview empty state says in one line what fills it, whatever
was spent today.

`classify_spend` (`src-tauri/src/budget/standing.rs`) alone says where spend
stands against a limit: clear, near or over. Spend equal to the limit is over,
and a zero limit is always over. The provider status, the provider alerts and the
session alerts all ask it. A provider warns at its rule threshold, a session
limit at the `warnRatio` the backend sends with it, so no screen holds its own 80.

The month comes from one clock, `SpendClock`: the time now and the UTC offset the
app sends with each call, so the month turns at local midnight and today never
exceeds this month.

## What Impact keeps

Work done in a session stays counted after it leaves the board, in Impact, the
Spend tab and the top bar spend chip.

| How it goes away                      | What happens to its rows                                                                          | What Impact keeps                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| You delete it in Goodboy              | transcript, file versions, slots, decisions and images are freed; the row stays with `deleted_at` | sessions, spend, pull requests, reviews and durations |
| Its worktree disappears from disk     | rows stay, the mount is marked `missing`                                                          | everything                                            |
| You archive it                        | rows stay with `archived_at`                                                                      | everything                                            |
| You remove or forget its project      | the mount row and its pull request links go                                                       | merged pull requests, through their `pr_merged` event |
| You remove its workspace              | rows stay, the workspace is disconnected                                                          | everything, under that workspace                      |
| A draft that never started is deleted | the row goes                                                                                      | nothing to keep                                       |

A deleted session shows in Impact with a **Deleted** label and does not open.
The store reads the archived and deleted spend once when the workspace opens
(`dormantSpend`) and adds the live sessions on top.

When Impact opens it asks the host before it trusts a stored state:

1. It runs the request sweep for live mounts and waits for a refresh already
   asking.
2. It settles up to 60 open pull requests of archived or deleted sessions and
   unmounted branches, one GitHub query per repository and project, asking by
   number for one the branch list leaves out.
3. When both are done, even if one failed, it reads its numbers again and shows
   only the newest read.

So a merge made on GitHub a minute ago, or after you archived the session,
counts at once. A merged pull request sits in the window of its merge on the
host, with the time Goodboy saw it as the fallback.
