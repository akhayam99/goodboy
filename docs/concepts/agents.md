# Agents and questions

> **Read this when** you change what an agent is, how it finishes, queues or
> closes, which kinds exist and how a kind is guessed, or how an open question
> is answered and delivered. **Not for** how the Lead hands out work
> ([../auto.md](../auto.md)) or how a workflow run moves between steps
> ([../workflows.md](../workflows.md)).

An **agent** is a separate chat inside a session, with its own provider, model,
effort, verbosity and kind. Start as many as you want and rename them in place.
A workflow starts one agent per step, next to any you added yourself.

## Life of an agent

- **Start**: `@` and a role in **Start a run** starts that agent at once, with
  the rest of the ask as its first message. An agent with no first message yet
  reads "Write to start" and does not count as needing you.
- **Finish**: an agent finishes on its own once its last turn succeeded, it has
  no open question, no turn is starting or running and no child still works.
  A new message opens it again. There is no "mark done".
- **Close**: only for an agent outside a workflow that is stuck on a failed turn
  or on its own question; it means "stop waiting on this agent". It reads "Closed by you" with a neutral check, and
  **Reopen** takes it back. A workflow step never has Close: closing it would
  leave the run blocked, so a stuck step is passed with Skip step.
  `isAgentClosable` and `isAgentClosedByUser` in
  `apps/desktop/src/features/session/agent-lifecycle.ts` hold both rules.

## The queue

Writing while a turn runs offers **Queue** (Enter), which waits for the turn to
end, and **Send now** (⌘Enter), which stops the turn, keeps what it wrote and
continues with your message. Queued messages sit above the composer, reading
**Waits for this turn** or **Sending now**, and can be edited, removed or sent
now. The Lead shows its unread messages in the same list
([../auto.md](../auto.md) **One queue**).

- Messages are saved in `agent_queued_messages`, survive a restart and go out
  one per turn in order.
- A window saves each message by id and deletes only what it removed, so two
  windows never erase each other's messages.
- A stopped agent keeps its queue until you continue it or send one now.
- A message leaves the queue, and the saved copy, only once the provider
  accepted it (the turn started, or the Resolve lane took it over). A send that
  ends before a provider turn starts (an error, a cancelled start, an unresolved
  step agent, a refused lease) puts it back at the head.
- When the queue cannot be saved, an error says so and the messages stay for
  this session.
- Once sent, the bubble in the chat says "Queued" or "Sent now".

## Lead

The **Lead** answers questions itself and hands the rest to agents of the right
role, with a model it picks for each, then reads their results and goes on.

- Its children are Scout, Plan, Investigate, Review, Implement, Test and Docs,
  never more than four at a time. A child that waits on a question can ask for a
  scout or an investigator, one more level and two at most.
- It is always available, with no switch in Settings. **Start a run** starts it
  when one agent fits the ask; `@` names a role instead.
- A Lead tree is one row in the Overview, one row of **Runs**, and one chat with
  a line per delegation, its tree in the run page's Agents column
  ([../auto.md](../auto.md)).

## Agent kinds

The **kind** decides what an agent may change and what it gives back. Each kind
has a default model, an effort and sometimes its own system prompt. The kinds,
in `AGENT_KIND_ORDER`:

| Kind          | Label            | Started from                                       |
| ------------- | ---------------- | -------------------------------------------------- |
| `planner`     | Plan             | spawn menu                                         |
| `scout`       | Scout            | spawn menu                                         |
| `implementer` | Implement        | spawn menu                                         |
| `debugger`    | Debug            | spawn menu                                         |
| `tester`      | Test             | spawn menu                                         |
| `reviewer`    | Review           | spawn menu                                         |
| `pr-reviewer` | PR reviewer      | a session that reviews someone else's pull request |
| `docs`        | Docs             | spawn menu                                         |
| `report`      | Report           | workflow step                                      |
| `wireframe`   | Wireframe        | workflow step                                      |
| `resolver`    | Resolve          | the Comments tab, never a workflow step            |
| `rewriter`    | History rewriter | a history replay that conflicts, hidden            |
| `scribe`      | Scribe           | pull request panel, hidden                         |
| `ci-debugger` | CI debugger      | **Analyze** on a failing check                     |
| `ci-fixer`    | CI fixer         | **Start fix**: one local commit, never pushes      |
| `auto`        | Lead             | **Start a run**                                    |
| `generic`     | Generalist       | spawn menu                                         |

`AGENT_KIND_META` (`apps/desktop/src/features/session/agent-kind.ts`) lists every
kind, and `visibleAgentKinds` decides which ones the menu offers.

### How a kind is guessed

Only three functions guess from a name, so no screen picks a kind its own way:

- a started agent (`classifyAgent`): the override, then the saved kind (old role
  names such as `investigator` map to their kind), then the name
- a workflow step (`classifyStep`): the step role, then the step name
- an agent not saved yet (`resolveAgentKind`): the override, the name, then the
  first user message

### History rewriter

Goodboy starts it only when an Edit commits plan hits a conflict git cannot
settle and you press **Rewrite with an agent**. A rebase on main never starts
it: a conflict there stops and asks, and **Start new Lead** hands it over.

- It works in a throwaway copy of the branch, never in a mount, with `origin`
  pointed at a push URL that always fails, no GitHub token and no bridge mount.
- It reports with `<<history-step>>`, `<<history-done>>` or `<<history-stuck>>`.
  The engine rebuilds the commits with the plan's messages and authors, checks
  the count, and moves the branch itself.
- When the checked result changes files outside the plan, the copy is kept 24
  hours from that check. The deadline survives restart, cleanup respects it,
  reviewing does not extend it, and a review accepts only the head it showed
  while the copy lives. `apps/desktop/src-tauri/src/history/copies.rs` owns
  retention; [Branch history](../features/branch-history.md) owns the review.

### Scribe

Scribe writes text about the code, never code: a pull request title and body, a
commit message for a squash or a reword, a changelog entry. It answers only with
`<<pr-title>>`, `<<pr-body>>`, `<<commit-message>>` and `<<changelog-entry>>`,
runs with push blocked, and Goodboy opens or edits the pull request itself.

1. `Write with Scribe` in the create form starts a text-only job (`isTextOnly`):
   after its first turn the work is `ready` and `settleScribe` stops, so writing
   never creates.
2. The form fills its fields from `scribeWork[key]`, so leaving and coming back
   shows the same state. `stopScribe` drops a running job.
3. Creating is the form's own step: `createPrForSession`, or
   `createMrForSession` on GitLab. `createPrForSession` pushes with
   `--set-upstream` first, for every writer (the form, the suggestion, an agent
   through the bridge).

A Scribe started from its own chat card still opens the request: `settleScribe`
hands the text to `openScribePullRequest`, and the work moves `writing`,
`creating`, then `created`, or `failed` with the reason and the text kept, where
`Retry` runs the step again. The Next row's Create pull request only opens the
form; while the job writes or creates, its line shows the state with no button,
then `Review text`.

- Its agent stays a scribe after the first turn. A follow-up with new blocks
  merges into the proposal (a block it leaves out stays) and reaches the request
  while the body still carries the signature.
- The proposal is read back from the transcript (`scribeProposal`), so it
  survives a reload with no table of its own; only `creating` and `failed` are
  in memory.
- A body Scribe wrote ends with an invisible `goodboy-scribe` signature. After
  Goodboy pushes new history it rewrites the body only while that signature
  still matches, so a body you edited stays yours.

## Open questions

An open question is something an agent cannot decide for you: the question,
suggested answers, an optional recommended answer, and whether one or several
answers apply.

- **Blocking**: it stops the work that asked and holds its workflow run. It
  cannot be dismissed, only answered or closed with **Send as message**, which
  sends your text as a normal message and closes the question once it went
  through (`sendQuestionAsMessage`). If that turn is refused (budget, a folder
  held by another agent) or fails, the question stays open with your text and
  the reason.
- **Non-blocking**: it can be dismissed. One asked while an agent drafts an
  artifact is saved in its history as an assumption, with the recommended
  answer.
- **Delegated**: an agent can answer for you, with optional hints and a model.
  Its answer counts as yours, and the asking agent is told an agent gave it. A
  delegate that answers nothing is nudged once, then fails. Answering yourself,
  or taking it back, stops the delegate, and a delegate's own question is never
  delegated again.

### Staged, saved, then delivered

1. Answering stages the answer, with Undo, while the same agent still has
   another question waiting on you.
2. Its last answer saves every staged answer of that agent at once.
3. The answers reach the agent in one turn once it has no open question left
   (one handed to a delegate still counts).
4. They are marked delivered once that agent's process runs, one agent at a
   time, so a reload or a provider error never offers them again.

Answered and delivered are two facts: an answer saved but never sent reads not
delivered, with Retry, when you open the session.
