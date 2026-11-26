# The run tree and activity rows

> **Read this when** you change how a run draws as a tree in the workflow
> detail, how a run or step row reads in the activity feed (role, model,
> effort, time, cost), how sub-agent sets fold, or the Next action strip.
> **Not for** what decides whether a run can move ([advancing.md](advancing.md))
> or how time is measured ([../turns.md](../turns.md#measured-time-and-estimates)).

## The run tree

The workflow detail draws the run as a run tree (`RunTree`), the stream the
activity feed builds, limited to one run (`buildRunTreeStream`). The Lead page
draws its own tree (`LeadTree`, [../auto.md](../auto.md)) and does not read
this stream.

- Steps run top down in the order they ran; queued steps come last, dashed.
  There is no NOW, no session spine and no time column.
- Sub-agents sit one column right of their step, on the run's colour, and so
  does their label, so the nesting reads in the text too. A step keeps its
  place whatever its sub-agents do.
- The view opens scrolled to the row that runs or waits on you. The run header
  and the Next action strip stay pinned.
- Clicking a row opens that agent.

The agent that asked a question, even a sub-agent, gets the question mark on
its node and **Answer** on its row. An agent that answers a question for a step
never shows it, in the tree or the feed: the question belongs to that step. The
step that produced a plan shows **Review plan** while the run waits on it and
**Open plan** after; both open the plan drawer. The action column exists only
while a row has an action.

### Folded sets

A set of sub-agents, the children of one agent, folds into one row under its
parent when every one is settled and none has an open question
(`foldSettledSets`, over the run tree's items, so the activity feed and its
stream builder are untouched).

- The row says what the set holds, for example `3 scouts · done`.
- A set with a running, queued, waiting, failed or asking agent stays open. A
  new or restarted sub-agent opens a folded set again.
- A set settled when the page opens starts folded. A set you watched settle
  stays open until you fold it. Leaving the page forgets it.

An agent's conversation names each sub-agent in one line at its end
(`DelegationLines`). A planner lists only its question delegates.

## Activity rows

A run tree row and an activity feed row read the same: role glyph, title,
model with effort, then time over cost. The role is the glyph alone, with its
name as the accessible name. The agent header reads the same way.

- When a step moved to another model (a fallback, a retry, a routing change),
  the model cell lists every model in the order it ran.
- The role card on the glyph holds the task, the state, each model that ran,
  the tokens and the cost. Why a model took over is in the cards and the
  Brief.
- The run row shows the models of its steps and what the whole run spent. The
  step it reached ("Step 4 of 7", or "Step 4" for an orchestrated run) is in
  its glyph's card.

### Planned and ran

- Before a step starts, its meta shows the planned routing in faint. Once it
  runs, the meta shows what actually ran, and the role card names the plan when
  routing picked something else.
- Effort works the same way: the column shows the effort the CLI was started
  with. A run with no recorded effort (from before turn spans, or a CLI with no
  effort flag) keeps the planned effort in faint and never shows a made-up
  value.
- The role card draws effort as a neutral meter, one segment per level the
  model offers, filled to the level that ran. It never takes a colour. Rows
  keep the word only.

## The time column

The time column is measured machine time, never the wall clock between start
and end. A `~` always marks an estimate; how sure it is lives in the tooltip
with the sample count.

- A queued step shows its usual range ("~6-9m").
- A running row with enough history shows the time left and its node fills an
  arc toward the usual time. Past the band it shows the elapsed time in the
  warning tone. Without enough history it shows the elapsed time only.
- A row that waits on you freezes the arc and the time in amber, never "left".
- A finished row shows its active time.

At twice the usual time the Brief's Now adds a line that points at the
transcript; nothing stops the agent. The run row and the workflow detail
header show a total or time left only when every step left has an estimate
(and, for the header, none is past its band). An orchestrated run reads it from
past orchestrated runs.

## Next action

When a run needs you, one **Next action** strip says what to do. It sits on the
workflow run row and at the top of the agent detail body; the conversation does
not repeat it. Every door (Activity, Workflow, the board, a toast) opens the
agent on its one conversation (`AgentDetailPane`, `ChatView`
`mode="conversation"`). Orchestrated runs say the same states on their tail
([run-pages.md](run-pages.md#the-tail)).

- **Failed**: **Continue** asks the agent to verify and finish, **Skip** asks
  inline first; the error sits behind **Show details**.
- **Blocked** (stopped without finishing or asking): the same verbs, on the
  warning rail. Writing to the agent also resumes it.
- **Quiet**: once a running step has said nothing for 15 minutes, the strip
  reads how long it has been quiet, such as "No output for 20 min", with the
  last event. **Continue** stops the silent turn and asks the agent to check
  where it stands; **Skip** skips it.
- **Stopped**: no strip. The header offers Continue; a step you stopped is
  never an alarm.
- **An open question no row shows**: the question with **Answer**, in the
  workflow detail only. **Answer** opens the agent that asked at its question,
  or the questions view when no agent asked.
- **The summarizer holding the run**: a line with nothing to click.

- The quiet clock is the shared `useNow` tick, no timer per agent. It holds
  while a tool call or a permission request is open, because a build or a test
  suite can print nothing for minutes (`quietSignal.ts`, `useQuietStep`).
  Goodboy never skips on its own.
- A question a run tree agent asked stays on that agent's row, so the strip
  never repeats it.
- In the agent detail, the strip shows only on the agent the failed step waits
  on, or one of its sub-agents.
- `resolveNextAction` picks the strip from the advance state. It reads
  `resolveWorkflowAdvance` and never decides on its own whether the run can
  move.

The workflow detail header says nothing about an open question while the run
tree is open. Collapsed, it keeps one quiet needs-you count that opens the tree
on the row that waits on you.
