# How a step ends

> **Read this when** you change the scope line every step prompt ends with,
> how the harness reads a step's markers, what happens when a step ends
> without its done marker, the ended step notice, or the summary written after
> each step. **Not for** what decides whether the run moves on next
> ([advancing.md](advancing.md)) or how a turn starts and reads a CLI
> ([../turns.md](../turns.md)).

A step finishes when its agent writes a `<<step-done ...>>` marker or saves a
plan. Goodboy then writes the handoff the next step reads. A turn that ends
without the marker takes one of the paths below.

## The scope line

Every kickoff, re-kick and recovery prompt ends with the scope line from
`composeUnitBoundary`. It names the done marker and the question channel.

- Every turn must end in `step-done`, `step-stuck` (or the `cluster-` pair) or
  one question.
- A question in plain prose never reaches the user. An agent that needs an
  answer, an approval or a confirmation asks it in a blocking
  `<<ctx-question>>` block and stops.
- Before it asks, the agent checks the decisions in the shared context. An
  active decision that settles the point is followed, even when it says
  assumed or proposed. An agent that finds it wrong follows it anyway, says why
  in its report and leaves the change to you. The same rule
  (`DECISION_FIRST_RULE`) sits in the context handoff protocol and the Auto
  child kickoff.
- When a step touches what an active decision governs, the orchestrator brief
  names that decision by number and restates its rule.

Every provider gets the same asks in the same words. Claude takes the protocol
in its system prompt; for the others `renderHandoff` puts the same guards and
role instructions at the top of the message. Every continue, answer and
recovery prompt repeats the scope line (`withStepBoundary`).

## Reading markers

`canonicalizeMarkers` (`packages/core/src/context/`) runs first in
`extractStepDone`, `extractHandoff`, `extractMarkers`, `hasBlockingQuestion`,
`extractPlanFromMarker`, `extractClusterDone`, `stripControlMarkers` and the
Auto child closing (`parseChildClosing`). It rewrites a known marker to its
plain form when a provider printed it with escaped brackets, HTML entities, a
space after `<<`, an upper-case name, curly double quotes around a value, or
(for `step-done` and `handoff` only) one closing bracket. Backticks, a code
fence, extra spaces, single quotes, a bare id, a marker followed by more text
and a marker split across streamed deltas already parse.

Content between a block's open and close tags is never touched, and a
single-bracket `ctx-decision` stays text. The id check is strict everywhere: a
marker for another agent, an empty id and a bare `<<step-done>>` (an agent
talking about the marker) never count.

## When a step stops without its done marker

When a step or a sub-agent ends a turn without its `step-done` or
`cluster-done` marker, `holdForUserQuestion` looks at the turn first:

- **It carries a `<<ctx-question>>`.** The step waits for your answer. No
  re-kick is spent.
- **It ends by asking you something in prose.** `extractProseQuestion` in
  `@goodboy/core` takes the asking paragraph from the turn's closing paragraph
  and Goodboy saves it as a blocking open question owned by that agent. It
  shows with the other open questions and your answer goes back to the same
  agent. No re-kick is spent.

Only a question or request addressed to you counts. A reply that reports or
explains what was waiting earlier asks nothing, and an ask followed by a
closing paragraph of report is not the end of the turn. A question the
heuristic gets wrong still closes: choose **Send as message** on the card.

### Continue or pause

Otherwise `continueOrPause` decides. The app decides; the marker only adds the
reason, so no done marker after the retry is stuck as well.

1. A hands-free step or sub-agent is re-kicked once, unless it sent a stuck
   marker.
2. If it sent a stuck marker, or the re-kick did not finish it, it is not
   finished: status `skipped` with the reason in `outputSummary`, and the run
   goes on through `skipStuckStepAndAdvance`. A paused run or a plan held for
   approval starts nothing.
3. A sub-agent that comes after it does not start (`Did not start:`,
   `skipDependentsOfStuck`).
4. The second not finished agent in a row blocks instead
   (`isAfterStuckAgent`).

With autorun off, or at once, the agent stops in one of two states:

- `failed`: the agent died. Its last turn ended with a stream error or no
  output. A crash, a non-zero exit, a spawn error, an auth or quota error or a
  kill ends the turn in `sendTurn` and is marked `failed` there.
- `blocked`: the agent is alive but did not finish, and asked nothing. The
  runaway breaker (4 unattended workflow turns in an hour, only when no limit is
  set) and a sub-agent whose plan instructions are no longer readable also end
  in `blocked`. A blocked agent resumes when you write to it, or through Ask it
  to continue and Skip.

### When no end path ran

`watchStepEnd` (`store/slices/workflows/stepEnd/`) looks four seconds after a
step agent's turn settled. When the step is still `running`, no turn runs or
starts for it, no child works, no mount continuation waits and no open question
of the agent waits for you:

1. It sets the step to `blocked`.
2. It raises one warning notification.
3. It writes one line to the app log through `log_step_end`:
   `[turns] step ended without a result agent <id>: <reason>`.

A failed write shows "Couldn't mark the step as ended" and leaves the step as
it was.

## The ended step notice

A step that `watchStepEnd` blocked reads "This step ended without a result" on
the agent page (`WorkflowAdvanceStack`, `StepEndedNotice`), with **Mark step
done** (`markStepDone`, which finalizes the step with `force` from the agent's
last words). The run page reads only **Needs you** with **Open step N**.

The notice shows only while the agent's `completedAt` still equals the end time
`watchStepEnd` recorded in `silentlyEndedSteps`. A step blocked for any other
reason (a missing artifact, a question, the unattended-turn breaker, a budget
stop) keeps its own copy.

### The dock of a blocked step

**Continue** and **Retry** live only in the dock of a blocked step
(`DockStepLine`). The composer reads "Answer the step".

- With text, **Continue** or Enter answers the step (`answerBlockedStep`,
  through `useBlockedStepAnswer`). With no text, **Continue** asks it to go on
  (`askAgentToContinue`).
- The text leaves the field before the turn starts and comes back
  (`restoreDraftOnFailedSend`) with the failure on the dock line, also when the
  session budget or a busy folder stops the send or no turn starts
  (`answerBlockedStep` waits for `onStarted`). One press at a time goes
  through. Attachments in the field block the send.
- An open ask, a live turn of the step or a blocked composer (archived session,
  provider signed out) hides the line or disables **Continue**, and Enter takes
  the normal composer path.
- The press counts as attended: both commands clear the step's unattended-turn
  count (`clearWorkflowTurns`) and carry the composer's route
  (`routingOverride`) to `sendTurn`.

The Sessions reason of a run with a halted step reads the `runStateOf` word
(**Not finished** or **Failed**) through `stoppedRunWord`.

## The post-step summarizer

Goodboy turns a finished step's chat into the handoff the next step reads
(`summarizeWorkflowAgentOutput`), so step N+1 never reads step N's full chat.
The summary follows fixed rules (`packages/core/src/summarizer/step-output.ts`):

- a one-line outcome first, and a maximum length
- the step's expected output before everything else
- facts in order of importance: file paths, decisions, actions, problems,
  blockers
- no label the step made up

**The summarizer never decides if the step succeeded.** If the model fails,
times out or breaks the rules, the summary retries across the other allowed
models ([helper retry chain](../turns.md#helper-retry-chain)). When every model
failed, Goodboy cuts the chat down to its start and end, with no model
involved, and marks the result `degraded`. The step still completes, and one
notification per session offers to retry.

## Tests

- `store.kickoff-markers.test.ts` pins, per provider and role, the step-done
  line with the agent's own id, the question block, the decision protocol, the
  planner's plan block and the scout's handoff hint.
- `packages/core/src/providers/markerMatrix.test.ts` runs every marker through
  the real line shape of each provider, partial deltas included.
