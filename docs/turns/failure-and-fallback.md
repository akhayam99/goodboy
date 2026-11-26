# Failure and fallback

> **Read this when** you change how a failed turn is classified, which model a
> fallback moves to, the usage-limit stop, or how a background helper call
> (summarizer, step summary, titles, orchestrator) retries. **Not for** a lost
> admission ([recovery.md](recovery.md#turn-admission)) or which errors end a
> stream ([stream.md](stream.md#when-a-turn-ends)).

## A failed turn

`classifyProviderError` names the failure. A usage limit puts the provider on
cooldown until its reset. `planTurnFallback` then plans at most two fallback
attempts. An unclassified failure or a cancelled turn never falls back.

| Failure                             | Fallback                                                                                  |
| ----------------------------------- | ----------------------------------------------------------------------------------------- |
| Any, on the first attempt           | The role's configured fallback, unless the failure is a usage limit on that same provider |
| Usage limit, authentication failure | Another provider at the same cost tier                                                    |
| Unreachable provider                | Retried once on the same model                                                            |
| Rate limit                          | A tier down on the same provider                                                          |
| Unavailable model, outdated CLI     | A sibling model on the same provider                                                      |
| Anything else                       | Another provider                                                                          |

Candidates are connected, enabled for the session and not cooling down.

A fallback marks the failed run, posts the original error plus a notice naming
the move, and reruns the same input on the same mount target. An agent pinned
to a signed-out provider tries it on every turn, so the transcript keeps the
first error banner and notice and drops a later identical pair (same provider,
same move). A different move shows again.

### Usage limit with no fallback

A usage limit with no fallback notifies. When the provider names its reset
time, it records a limit stop (`store/slices/limitStops/`) holding the
request, and the error row offers **Continue at** that time next to **Retry**.
Nothing is scheduled until the person clicks: `continueAfterLimit` starts one
timer that sends the stored request once on the same model, and
`cancelLimitContinue` stops it. A new message to the same agent, or a newer
stop, drops the offer.

Any other failure leaves the agent in `error` with a retryable error event.

## Helper retry chain

Background model calls that nobody waits on retry on their own: the session
summarizer, the workflow step summary, the titles (session, workflow, workflow
run, suggested) and the orchestrator's decision. They all go through
`runHelperTask` (`store/slices/providerLimits`), which wraps
`runWithModelFallback` (`packages/core/src/providers/background-retry.ts`).

### Order and bounds

1. The task's own model goes first: an explicit task model setting, or the one
   a retry with another model picked. Cooldown routing still moves a cooling
   provider off the front.
2. A generic failure (non-zero exit, empty or unparseable output, network)
   retries the same model once after 1.5 seconds. A timeout, a quota or rate
   limit, an authentication or model error moves straight to the next
   provider.
3. Fallbacks are one aligned model per other provider, in pool order. They
   stay inside the session's enabled providers, skip a provider that already
   failed in this chain or is cooling down, and never pick a hidden model.

The chain is bounded at 4 attempts and 6 minutes. When the work is discarded
meanwhile (the orchestrator's restart or stop), it stops.

### Provider memory

- A provider that failed twice in one chain before another model answered is
  kept off the front of later chains for 3 minutes (`helperProviderFailures`),
  so each summary does not pay two failed spawns first.
- That memory is never written to `providerCooldowns`, so turns are
  unaffected.
- A usage, authentication or rate limit still records the provider cooldown.

### Notices

Nothing notifies while a chain runs or after it succeeds. Only a chain that ran
out of models raises one notice, with Retry. A later success clears it, and
rows that were resolved while the app was closed are cleared when
notifications load.

| Task                              | Notice                                 | Key                                 |
| --------------------------------- | -------------------------------------- | ----------------------------------- |
| Session summarizer                | Summarizer failed                      | `summarizer-failed:<sessionId>`     |
| Step summary                      | Step summary unavailable               | `step-summary-degraded:<sessionId>` |
| Orchestrator reply not a decision | Couldn't read the orchestrator's reply | `orchestrator-unreadable:<runId>`   |
| Orchestrator call failed          | The orchestrator failed                | `orchestrator-failed:<runId>`       |

- The step summary notice is one per session, not per step. Its Retry retries
  every degraded step of the session.
- An orchestrator Retry asks the orchestrator again for that run.
- A model that is no longer available to the account still raises
  **Summarizer model ... is unavailable** once per model, because the setting
  needs fixing.
- **Orchestrated run blocked** is not a failure: the orchestrator chose to stop
  and needs you. It raises once per run with **Open agent**, reads as plain
  text (the reason's markdown marks are dropped), and clears when the run moves
  on.

### The workflow agent's own handoff

A workflow agent's own handoff (`summarizeAgentOutput`) runs once per agent at
a time with a 90 second timeout. A failure goes through the chain, and only
when every allowed model failed does it fall back to the deterministic summary
flagged `degraded`.
