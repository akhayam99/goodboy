# Context updates after a turn

> **Read this when** you change the session summarizer, the decisions ledger
> or the learnings pass that run after a successful turn. **Not for** the
> workflow's post-step summarizer
> ([../workflows.md](../workflows.md#the-post-step-summarizer)) or helper
> retries ([failure-and-fallback.md](failure-and-fallback.md#helper-retry-chain)).

## The session summarizer

After each successful turn the session summarizer condenses what happened into
the session's context slots, which the next turn reads as its preamble. It is
the chat's handoff, as the post-step summarizer is a workflow's.

### Queueing

- One summarization runs per session, when the app is idle. Turns that finish
  meanwhile wait together for the next pass; the oldest drop out past 20,000
  characters, with a note saying how many.
- It runs on the summarizer task model, routed around cooldowns. When every
  candidate is cooling down it pauses and offers a retry.
- A consolidation pass waits behind them, at most one per session. It is
  queued when a run finishes, a pull request merges (`pr_merged`), the active
  decisions go over budget after a pass, or you press **Update now** in the
  drawer (a pass already queued is marked as requested instead). It records
  `decisions_changed` with `consolidatedAfter` (`#612 merged`,
  `the run finished`, `decisions went over budget`, `you asked for an update`).

### Writes and failures

- Slot writes are compare-and-set against the snapshot it read. A slot the
  user changed meanwhile is never overwritten; the summarizer runs again on
  the new value. A slot that comes back over twice its budget gets one more
  pass.
- Any failed pass retries through the helper retry chain. The turn never fails
  because its summary did.
- A summarizer CLI that exits non-zero reports
  `summarizer cli exited with code 1: <detail>`: the `error` or `result` text
  of a failed stream-json result event, else the last three lines of stderr
  (ANSI stripped, 400 characters at most).
- **Summarizer failed** raises only when every allowed model failed, once per
  session (`summarizer-failed:<sessionId>`), and a later success clears it. It
  names the cause in plain words (`Cursor isn't signed in.`), never the raw CLI
  line, which stays in the session's summarizer status.
- Its spend is summarizer telemetry, apart from turn spend.
- Each pass stores its round in `summarizerRounds` (turns read, route, tokens,
  cost, which of goal, decisions and summary changed) for the drawer's
  **Context updates** row, in memory only.

## The decisions ledger

Decisions live in `session_decisions`, not in the text of the `decisions`
slot. Each has a number per session (`D7`), a status (`active`, `replaced` or
`withdrawn`), who wrote it (an agent, the summarizer or you), the agent and
turn it came from, and the reason it left. The slot is derived: the active
decisions, newest first, one `- D7 text` line each, rewritten after every
change, so the preamble, the mobile companion and the snapshot read one
string.

- `packages/core/src/context/decisions-ledger.ts` is pure: `applyDecisionOps`
  takes `add`, `reword`, `merge`, `replace`, `withdraw` and `restore`, and
  returns the ledger, the changes and the refused operations.
  `decisions-ledger-store.ts` loads, applies, saves and rewrites the slot.
- The desktop applies every write through `applySessionDecisionOps`
  (`store/slices/decisions/`), which records one `decisions_changed` event with
  `{ added, replaced, withdrawn, merged, restored, decisionChanges }`. A reword
  records none.

### Rules

- A decision nobody names stays as it is.
- Withdrawing or replacing needs a reason from the summarizer; an agent's
  withdrawal carries its reason as the marker body.
- Reword and merge keep the number. A merge keeps the lowest and marks the
  others `replaced` by it.
- What you withdrew is a tomb: a marker with the same text does not bring it
  back. What you wrote or edited the summarizer can only replace with a
  reason, never reword, merge or withdraw.
- A session made before the ledger is seeded from its slot on first read, in
  the slot's order.

Agents add with `<<ctx-decision>>`, replace with
`<<ctx-decision replaces="D3">>` (optional `reason="..."`) and withdraw with
`<<ctx-decision withdraw="D5">>why<</ctx-decision>>`. An addition that matches
an active decision after normalizing (case, bullets, spaces) is a no-op.

### The summarizer's answer

- It never writes the `decisions` slot (an upsert of it is dropped). It answers
  `{ upserts, decisionOps }` and names decisions by number.
- An `add` without a `why` is dropped: a line with no reason is state, not a
  decision. The `why` is kept on the row and shown under the decision in the
  context drawer.
- Operations that do not parse fail the answer, which is asked again once.
- Its summary is three sections, `Learned`, `State`, `Next`; an old `Problem`
  section is dropped on the next pass.
- A consolidation pass (`mode: 'consolidate'`) has no turn and keeps only
  `merge` and `withdraw`.

Writing the slot from the editor or the mobile companion goes through
`reconcileDecisionsText`: numbered lines keep their decision, a missing number
is your withdrawal, a new line an addition. The preamble shows the numbers and
teaches the two attributes, and over budget keeps the top lines, the newest.

## Learnings

A successful turn joins a per-agent learnings queue (`learningQueue.ts`) only
when its role received the "Explain more when the work touches" line and that
field has topics. One pass runs at a time per agent; turns that finish
meanwhile are read together and the learning cites the merged range. It runs
on the `learnings` task model (Models, Writing for you), off the summarizer
queue, records its cost like the summarizer, and writes
`session_context_items` of kind `learning` only for concrete explanations of a
listed topic. `context.learnings` set to `false` stops new passes.

## Under the hood

- `packages/core/src/summarizer/decisions-eval.test.ts` is the fixed eval:
  rewording, merge, contradiction, state dressed as a decision, an Italian
  marker, a list over budget.
