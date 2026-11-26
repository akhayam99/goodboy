# Lead children on screen

> **Read this when** you change how an agent the Lead started shows: its line
> in the Lead chat, its name, why it stopped, its result card, its own page, or
> a message typed to it. **Not for** the Lead's own page and dock
> ([chat.md](chat.md)), the tree in the Agents rail
> ([lead-page.md](lead-page.md)) or what a result holds
> ([results.md](results.md)).

## Delegation lines

Each delegation is a line in the conversation (`AutoDelegationLines`). Lines
read the delegation, attempt and agent rows, never the message text, so a
reload draws the same lines. The lines after one reply share one list
(`mergedBatchesOf`).

- A settled line is bare: role chip, the task Auto gave and **Open**.
- A line in flight (`AutoChildCard`, facts from `autoChildCardFactsOf`) adds
  the state word in its meaning's colour (`AUTO_STATE_TONE`) and the active work
  time.
- A revision reads "revising v2", then "v2 ready".
- A child that waits for an OK carries the **Next step** card
  ([workflows-and-plans.md](workflows-and-plans.md#confirming)).

The whole line opens the child (`useAutoTreeActions` `openChild`). Its right
click menu holds **Stop**, which names the child; a failed stop leaves the line
working with a notice. The work time is `DelegationClock`, the same number as
Working now and the Agents row, so a resumed child keeps its earlier work.

## Names

`autoChildLabelsOf` is the one name function: the rail row, the delegation
line, the result card and the delivery text Auto reads all use it.

1. Auto may give a child a `title` of at most eight words
   (`DelegateChildSpec.title`, cut to `DELEGATE_TITLE_WORDS`, stored as
   `request.title`). It joins the request hash only when set, and a retry keeps
   the title of the work it repeats.
2. Without one, the first sentence of `request.task`, heading lines skipped, cut
   at a word end near 60 characters (`taskTitleOf`).
3. An old row with neither gets the role noun, numbered by start order when a
   role has two or more (**Reviewer 1**, **Reviewer 2**; adopted agents left
   out of the numbers).

The role shows as its glyph, with the noun in its tooltip and accessible name.

## Stuck children

A stuck child is a Next card headed by its branch and pull request ("Lead needs
you" only when the branch is unknown; `actionCardsOf`). Its sentence names the
role, never the quoted ask, with one verb per child state (`The scout never
started.`; `autoStuckKindOf`, `autoStuckVerbOf`), then the sentence of its
reason code (`delegationReasonTextOf`), never the child's own words. Its verb is
**Retry**, accessible name `Retry "<name>"`. While a child is stuck and Auto is
live, the board row of its branch shows it as stuck (`AutoGroup.isStuck`).

The second line of a stuck child on the rail and in the Running card
(`delegationSentenceOf`) is a returned child's own summary
(`delegation.result.declared.summary`), else the reason code's sentence, else
nothing. Never a code like `declared_blocked`. A done child shows the result it
declared, then the summary Auto accepted, never the working `outputSummary`
(`autoGroupOf`).

### Not stuck

- **Returned.** A child that returned to Auto has no card
  ([stops.md](stops.md#a-child-that-returned)).
- **Stopped.** A delegation that settled `stopped` (you or Auto stopped it, or
  you declined it, reason `declined`) is state `stopped`, which
  `autoStuckKindOf` does not count. It reads **Stopped** on the rail.
- **Replaced.** A settled child that did not complete is state `retried` when a
  later delegation takes the same role on the same branch (`target.mountId`),
  with or without `retryOf`.
- **Gone.** A child whose agent row is deleted (`deleted_at`) or moved to another
  session is left out of the tree read, with the failed attempts that a retry or
  a later same-role, same-branch delegation replaced (`listGoneAutoChildIds`,
  `presentDelegationsOf`). Their agents go into `hiddenChildIds`, so an earlier
  attempt still in the session does not come back as a linked child.

Every reader of `autoTreeViews` (Next, the Running and Done cards, the rail, the
counts) sees the same list. A child accepted and not started yet (no agent row)
stays. **Retry** after the child left reloads the trees, sends nothing and says
"This agent is no longer in this session. It was deleted or moved."
(`useActionCardActions`).

## What the agents reported

Each child result Auto read for a turn is a card right after that turn's **What
the Lead was told** row and before Auto's reply (`AutoDeliveryResults`,
`AutoResultCards`). The header holds the role glyph, the name, the model with
its provider and **Open**. The body reads in the order of
[turns.md](../turns.md):

1. One outcome line, which is the state word: the child's `<<outcome>>` line or
   the one `outcomeLineOf` computes. Red checks or a failed push override the
   model line, because `deliveredResultsOf` computes it once with
   `delegationResultOf` and the card only draws it.
2. The artifact rows, the same as on the delegation lines. Then the agent's prose
   sits behind a closed **Earlier in this reply, N lines** (`ReadingNotes`,
   `summaryNotesOf`).
3. With no artifact, the report in `ClampedProse`, three lines then **Show
   more**. A failed, stopped or timed out child shows only the outcome line.

A plan that waits for approval has no row on the card; its ask is on the line.

The cards read data, never Auto's prose. An accepted `results` row keeps the
root run that read it (`accepted_run_id`), read as `deliveredResults`, and each
delivery row (the `auto_delivery` item keeps its event's `runId`) draws only
the results of its own run. A result whose delivery row is not in the transcript
is not drawn, never moved to the end, so a late result stays with its turn.

## The child page

Every door (a tree row, a delegation line, the Overview, a notification, Search
or run) lands on one page with one box (`useAutoChildChat`, `AgentDetailPane`);
a saved window that held a removed panel opens it too (`withoutRemovedPages`).
The title is the task Auto gave, or the brief's first line. Top to bottom:

1. `AutoChildBrief`: "The Lead started this agent and reads your messages to
   it.", why this role, the model and provider (no dollar amount: a child holds
   no money) and a note when the app changed the model
   ([Why an agent exists](#why-an-agent-exists)).
2. The conversation.
3. `DelegationResult`: the outcome line (a red check or failed push replaces the
   child's sentence), chips for files, checks, each failing check, **Retry
   checks**, the push state with **Retry push** and **Undo force push**, open
   questions (four, then **+N**), and a closed **Earlier in this reply** with the
   summary, open only when red (`splitArtifactText` drops artifact blocks).
4. The tail (`autoChildLive`): **Queued**, the live line with **Stop agent**,
   **Waiting for your OK** with **Confirm** and **Decline**, **Asked a
   question**, **Failed: <sentence>** or **Returned to the Lead**.

A failed child's tail has no recovery: the dock owns **Retry** through Auto
(`AutoChildEnd`, `ConversationDock/useAutoChildRecovery`,
`continueStoppedAgent`). A stopped or done child has no tail; for a stopped one
the dock's **Continue** asks Auto for a `retryOf` on the same agent, never a
plain turn ([turns.md](../turns.md), resume rules). The end line sits at the
delegation's `settledAt`, so a later plain turn reads below an older Failed.

## Why an agent exists

`AutoChildBrief` (`apps/desktop/src/features/auto/child/AutoChildBrief.tsx`,
inserted by `useAutoChildChat`) tops the transcript. Every line comes from the
stored delegation through `delegationCardOf`: Why the Lead chose the role
(`reason`), Why not the role fit when stored ([roles.md](roles.md#role-fit)),
Done when (`doneWhen`), Went in, the routing, and Attempt n when the `retryOf`
chain is longer than one (`delegationAttemptsOf`). It is a pure function of that
agent's rows, so a late result for another agent does not repaint it. The brief
is the first message, the full brief opens from the crumb (`AgentBriefCrumb`)
and there is no side panel for the record.

### Went in

Went in (`AutoChildWentIn`) lists the launch snapshot as given to the agent,
never as read by it: one line per note (with the turn the Lead read it at),
image, artifact (with its version) and guidance.

- `startAttempt` writes `auto_attempts.launch_snapshot` once, in the
  transaction that inserts the attempt. A snapshot that cannot be written fails
  the start, so no half-started attempt exists.
- `launchSnapshotFor` (`store/runtime/auto/launchSnapshot/`) builds it from the
  user notes up to the delegation and their images, the brief's artifacts and
  versions (`inputArtifacts`, the revise target), its run guidance
  (`kickoffGuidanceOf`) and the routing.
- Nothing rewrites it. A retry is a new delegation with its own snapshot; a
  resume after a question writes none.
- `childWentInOf` (`features/auto/child/childWentInOf.ts`) reads the latest
  delegation's snapshot (`launchSnapshots` in the view, `launchSnapshotOf`). An
  empty one reads "Nothing was given to the agent." A null one is a state, not
  an error: no Went in line, nothing recomputed, and the brief's images show as
  chips instead.

## Talking to a child

The child page has one composer, "Message Implementer". A message to a child of a
live tree is an attempt of its delegation, never a plain turn
(`routeAutoChildTurn`, from `sendTurn`, through the child turn port to the main
window's `continueChild`).

- **Ended child.** A continue of its newest delegation starts at once: same
  agent, role, worktree and routed model, the words as **New instructions**,
  outside Auto's turn (`autoContinueTreeStatement` holds the open, time and money
  caps). It settles to Auto like any attempt.
- **Working child.** The message waits in the agent queue (`agentQueue`, a DB row
  every window reads) and runs as that continue when the turn ends; a send that
  reaches it working is refused "still working for Auto" (`isBusy`). The
  `deliveryId` rides the port, so a resend replays instead of running twice.
- **Old tree.** A child of a finished, stopped or detached tree, or an older
  generation, keeps the plain confined turn, files included (`hasFiles`).

Auto's continue passes the admission's artifact checks (`admissionChildRefusals`,
`inputArtifactStatementsOf`) and waits as `awaiting_confirm` when its role's
start row is Ask (`admissionStateOf`); the person's message goes on unless an
input artifact was discarded. Auto's own `message` uses the same queue with an
`auto-message:` id (delegation, Auto's run, position), and saved text replays
(`messageChild`). A queued Auto message never takes the plain turn, and any stop
drops it; the person's stay. Questions wait for Auto's answer, artifact rewrites
go through Auto, and files are refused, each with a sentence.

`ChatView` hands its `agentId` to `ChatInput`, which keys draft, queue,
attachments, routing and send by it and remounts per agent. The store's selected
agent never decides the target.

### Every turn keeps its role and route

Whoever starts a child's turn, `routeTurn` reads its newest stored delegation
(`resolveChildTurn`, `getLatestAutoDelegationOfChild`) before each spawn, never
the window's tree view, and keeps that role and route through retries
(`recoverTurnFailure`, keeping `onSettled`). An adopted agent counts while its
adoption row stands.

`claimTurnAdmission` in `startTurnRun` claims it in one transaction before the
agent runs: the newest delegation must still be the one read, and the agent is
set running on the turn's run id. An adoption or detach from another window lands
first and refuses the turn, or comes after and is refused as a running turn. A
startup failure gives the claim back (`revertAgentStart`). A `turn_admissions`
row (m242) lives until the spawn ([turns.md](../turns.md#turn-admission)).

The turn runs only on the routed model (`isOnChildRoute` compares the catalog
key, so `claude-sonnet-5-5-xhigh` is on route `sonnet-5.5`) and on a provider
`autoChildProviders` allows. A composer pick, a retry aimed elsewhere, agent
pins, a fallback, a cooldown or budget move off the route are refused or
dropped, with a plain sentence for the person (`turnRefusalMessage`). A refused
retry reaches Auto as a failed end with that sentence (`startDeliveredTurn`
`failure`), never an empty success. A refused usage-limit continuation keeps its
stop and **Continue**, and Auto gets a note (`continueAfterLimit`,
`noticeAutoOfRefusedContinue`).

A reading role (Scout, Planner, Investigator, Reviewer) cannot write: Read, Grep
and Glob in plan mode on Claude, the read-only sandbox on Codex (read-only
commands still run), `--mode plan` without `--force` on Cursor.
