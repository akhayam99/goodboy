# Auto

> **Read this when** you change or explain the Auto agent: its release gate,
> how a person starts it, what it shows in the Overview and its chat,
> how a plan is approved, and which providers it may use. **Not for** the
> tables and the scheduler behind it ([architecture.md](architecture.md), Auto
> tree registry) or
> what a role is ([concepts.md](concepts.md)).

Auto is an agent that answers questions itself and hands the work it cannot do
alone to agents of the right role, with a model it picks for each. It waits for
their results, reads them and goes on. It is always on, and there is no switch
to turn it off. Since ux27 one flow unit 1 an Auto conversation is a row of the one **Runs** entry of
the session rail ("Agent · Auto agent"), so the rail has no Auto entry
to mark. Auto starts agents of the role it picks (`AUTO_ROLE_WHEN`), and
agents started by hand keep working.

## Status

The feature is on: `AUTO_GATES.isDelegationEnabled` is `true` and is the only gate. Settings has
no Auto switch and no Experiments band. The runtime (`startAutoRuntime`) runs in the main window,
ticks every 15 seconds from its start and drives the trees that exist. Another
window has no runtime of its own: it hands Stop, Retry, a message to Auto and a
confirm answer to the main window over a Tauri event
(`features/auto/bridge/`: `createAutoBridgeClient` in the other window,
`serveAutoBridge` in the main one) and waits up to 30 seconds for the answer. No
answer reads "The main window did not answer. Do it from the main window." on the
tail, and a message counts as not taken. Each forwarded message carries a
message id that stays the same while it is not taken, so sending the same
words again reuses it; the main window remembers each id for 10 minutes and
answers a repeat with the first answer instead of queuing the message twice
(a message main itself lost is sent again). An old
`agents.autoExperiment` row left in the database is never read, so a stored `false` hides nothing:
`useIsAutoOn`, the agent menu facts and `moveToAuto` read only the gate.

**Live proof before the flip.** The real CLIs were launched with the exact argv and prompt
Goodboy builds for an Auto turn:

| CLI    | Version               | Model             | Posture                             |
| ------ | --------------------- | ----------------- | ----------------------------------- |
| claude | 2.1.296 (Claude Code) | claude-sonnet-5-5 | plan mode, `--tools Read,Grep,Glob` |
| codex  | codex-cli 0.162.1     | gpt-5.6-sol       | `-s read-only`                      |

Both ended with a valid `<<auto>>` delegate block that `parseAutoBlock` and `parseDelegateSpec`
accept. Neither tried to write a file or run a shell command, and the work tree stayed clean.

## The release gate

- `AUTO_GATES.isDelegationEnabled` is `true` in this build and reaches the
  screens through `AutoReleaseContext`; `useIsAutoOn` returns it. A build with
  the gate false hides the Auto start and every Auto control and keeps the role
  start of before.
- Settings, App, General has no Experiments band. The **Experimental** marker
  stays on the Auto start (`NewDrawerBody`, `SessionKickoff`).

## Starting

Auto is always available and has no start of its own since ux27 one flow unit
5: the **Start a run** field is the one door (the New menu's **Start a run**,
⌘K, the Runs page and the New session page all open it). Every Auto
conversation is a row of the session's **Runs** page (`sessionRunsOf`), which
opens it in the Auto chat. There is no role list, no project field and no
guidance: Auto picks the mount and asks when it is ambiguous. A role is named
with `@` in the field, which starts that role at once with no Auto turn first.

- The **Start a run** field (`StartRun`) starts Auto when its router picks one
  agent (rows 4 to 6 of `runRouteOf`, see
  [Start a run](features/start.md#start-a-run)): `spawnAgent` with the `auto`
  kind and the ask as its first message, or the role named with `@`. The field
  carries the same **Limit** chip (`useAutoTreeLimit`), persisted before the
  start. The route is kept per agent in `runs.routes.<sessionId>`.
- A start never rereads a setting at the click: there is no mode another window
  can change, so the form on screen is the mode that starts.
- The goal is the first message of the Auto agent. It is not a plain turn: the
  tree is created at the start and the goal is queued in its outbox, so Auto's
  first turn is a delivery like every later one. A start that loses the message
  says "Auto didn't start" and the chat keeps no half-started turn.
- Auto runs on any connected provider that can confine a read-only agent
  (`AUTO_OWN_PROVIDERS`: not the opencode family, see Providers), with the route
  the workspace picks for the role.
- The **Limit** chip starts on No limit, or the budget of the session when it
  pauses ("Limit for this Auto run" in its popover, with a **No limit** action). The smallest
  limit pauses Auto, as for runs. A session budget that only warns caps no
  Auto run: every path reads the session cap through `pausingSessionCapOf`
  (`apps/desktop/src/features/budget/`), which gives `null` for one. A new tree
  starts on the smaller of that cap and the workspace's Auto limit
  (`autoTreeLimitOf` in `packages/core/src/auto/`, which also names the winner;
  `startAutoRuntime`, `moveToAuto`, `useAutoTreeLimit` and `setSessionBudget`
  read the session cap this way), and
  setting a session budget that pauses under a running Auto's limit lowers that limit
  (`setSessionBudget` calls `lowerAutoLimitsToSession`, one write per tree
  that lowers only a cap still above the new limit on a tree not finished at
  write time; only the write checks the cap and the phase, never the earlier
  read, so a cap another window lowered first still ends at the smaller one
  and is never raised, and a cap raised after the read is lowered too), so the next turn pauses on what is
  already spent. A limit exists only when a person sets one. It is stored for the
  workspace (`workspace_values` key `auto.treeLimitUsd`, compare and swap; No limit
  deletes the key), and a start never stores one the person did not set.
- A Next card that starts a role gets **Talk it through with Auto** as the last
  entry of its more menu. It is the registry verb `suggestion.talkWithAuto`
  (`features/actions/kinds/suggestion.ts`), shown whenever the card starts a
  role. It opens **Start a run** on Runs with the card as its text
  (`startTalkItThrough`) and starts nothing.
- **Generalist** keeps its name, with no mark of being old, and existing
  Generalist agents are not changed. Auto never appears in the manual role list.

## Moving an agent to Auto

**Let Auto take it from here** (once Move to Auto) hands an agent you started
yourself to Auto. It shows on old rows only: an agent that **Start a run**
started keeps a route in `runs.routes.<sessionId>` and never offers it. It is in the menu
of an Implementer, Tester, Scout, Planner, Reviewer, Debugger or docs agent and
of an old Generalist (the registry verbs `agent.moveToAuto` and
`agent.detachFromAuto` in `features/actions/kinds/agent.ts`, so the header menu,
the right click and the palette agree). It is blocked with "Wait for the turn to
end first." while the agent works.

- The verb opens the chat of the agent and replaces its composer with a panel,
  **What should Auto do next?** (`MoveToAutoPanel`). The field may stay empty. A
  handoff marker with `kind=auto` shows the same panel from the chip **Agent
  suggests: Auto**, which does not start an agent of its own.
- `moveToAuto` (`features/auto/moveToAuto.ts`) checks the release gate, then
  `adoptAgent` (`store/runtime/auto/adoptAgent.ts`) writes the
  whole transfer in one guarded transaction: a new Auto agent, its tree, one
  adopted delegation for the source (settled, `adopted = 1`), the plan and report
  artifacts of the source in `auto_artifacts`, and one `user` outbox row with the
  kickoff (`composeAdoptionKickoff`: what the user asked, the last reply, the
  artifacts, the mount and the words of the user). The tree starts in `merging`.
  Right after the commit `moveToAuto` drives the tree through the drive port
  (`autoDrivePort`, registered by `startAutoRuntime`), so Auto gets the kickoff and
  the result of the source at once. A window with no runtime leaves it to the
  scheduler tick of the main window, which delivers the same rows.
- One Auto per source: the transaction refuses an agent that has a delegation row
  or a tree (a second click returns the first Auto), a step of a Run ("Pause or
  finish the run first."), a running turn, a kind with no role, and any agent
  whose parent or child chain holds an Auto agent. A failure writes nothing and
  leaves the source as it was.
- The source keeps its row and its chat. Its composer is replaced by the notice
  **Moved to Auto** (`AdoptedNotice`) with **Open Auto** and **Detach from Auto**.
  Inside a tree the Continue buttons and the handoff chip are hidden.
- **Detach from Auto** (`detachAdopted`) is the undo, also offered in the toast of
  the move. It removes the adopted delegation, its artifacts and the words about it
  Auto has not read yet, and bumps the tree revision. It waits for the turn of the
  agent to end. The Auto agent stays in the session.

## Rebase conflicts

A rebase on main is plain git and never starts Auto. When it stops on a
conflict or a commit hook, the run keeps `rebaseConflict` (the onto ref, the
base, the head before the rebase) and the stop keeps the files
(`store/slices/history/rebaseBranch.ts`); the prompt asks the person. **Resolve
with Auto** (`mount.resolveRebaseWithAuto`) calls `resolveRebaseWithAuto`
(`store/slices/rebaseAll/resolveRebaseWithAuto.ts`): it starts one Auto agent
with `spawnAgent` and `kindOverride: 'auto'`, the route the workspace picks for
the role, and the goal `rebaseAutoGoal` writes, so the goal goes through the
Auto user turn port and, from another window, over the bridge. The goal names
each branch, its worktree, the onto ref and the conflicted files, tells Auto to
hand each branch to one agent that writes in that worktree, to ask the person
only when a conflict is ambiguous, to run `git rebase --abort` on a branch it
cannot finish, and never to push. The hint of **Add a hint** ends the goal. The
run is marked as handed (`autoAgentId`) only once Auto took the goal and only
when the run is still the one that was asked, so an answer that lands after
**Abort rebase** changes nothing. **Rebase all** (`store/slices/rebaseAll/rebaseAll.ts`)
rebases each branch with git first and hands every conflicted branch to the
same single Auto run; with **Also tidy commits with Auto** on, the goal also
lists every rebased branch to tidy, locally, after its rebase. **Resolve with
Auto** reads why when no provider can run Auto
(`autoUnavailableReason`).

## Talking to Auto

A message typed in the composer of an Auto agent is not a plain turn either. The
store's `sendTurn` hands an operator message for the root of an Auto tree to the
runtime (`routeAutoUserTurn`), which creates the tree if it is missing and
queues the text as a `user` outbox row; Auto reads it with the next delivery.
Approving a plan is the same path ("Approved plan v1."). Once the runtime has
taken a message, `routeAutoUserTurn` writes the user's own words to the
transcript as an `operator_text` event, so the bubble appears once at queue
time and never depends on the delivery. The delivery text Auto builds for its
own agent (the ledger, the budget line, the results, "MESSAGES FROM THE USER")
is stored with `deliveredBy: 'auto'` on its `user_text` event, set in
`startTurnRun` when the turn's origin is `delegation` (the root's deliveries
and a child's first brief). The transcript draws such an event as one collapsed
row, **What Auto was told**, never as a user bubble; opening it shows the text
as sent. A transcript written before this change has no origin on its events, so
its delivery text still renders as a bubble: there is no text sniffing. A
message the runtime
cannot take, or one with a file that is not an image, is refused with "Auto didn't get your
message" and the composer keeps its text.

**When a message waits.** A `user` row is delivered in every phase that takes a turn
(`chooseDeliveryRows`), except while the tree is `waiting` for running agents: there it
stays `pending` and goes with the next results, so a message typed during a long child run
reaches Auto only when the child ends. The chat says so under the bubble in one quiet line,
"Waits for <task of the child>" or "Waits for 2 agents", with **Send now**
(`AutoPendingMessages`, from `pendingMessages` of the tree view). **Send now**
(`runtime.sendNow`, through `registerSendNowPort` and the window bridge) delivers that one row at
once as its own Auto turn, like a child's question, and leaves the children running; the line goes
away when the row is claimed. The send runs in the tree's queue and claims the row with the tree's
phase revision and the row's `claimed_by`, so a child that ends at the same moment cannot deliver
it twice: whoever claims first delivers it and the other finds no row. A waiting tree with no
child in `starting` or `running` (a lost turn end) is the watchdog's case: `deliverNext` delivers
the pending `user` rows and logs one `[auto] ... waited with no running agent` line.

**A message the tree cannot take.** A `user` row is never sent to a tree that cannot run a turn,
and its line says so: "Not delivered: <reason>". A tree blocked by the budget shows the reason
with **Change limit** (raising it delivers the row, as before). A tree blocked for any other
reason but the time limit shows it with **Retry**, which resumes the tree and delivers the row
(the send itself already tries one Retry). The time limit and a stopped or stopping tree have no
action ("This conversation reached its time limit.", "Auto was stopped."): the row stays unsent
and the words are not lost from the chat. A `finished` or `done` tree takes the message as a
normal follow-up turn. Rows left from old trees show the same line on load and are never
auto-sent.

**Images.** A message to Auto may carry images. `routeAutoUserTurn` writes them once to the
session's scratch folder (`storeAutoImages`), so they have a full path, queues them on the `user`
outbox row (`images` in the payload) and shows them on the bubble (`operator_text` with
`attachments`). The delivery that reads the row hands them to Auto's turn (`storedAttachments` on
`sendTurn`, listed by full path in the prompt, never written again), and every child Auto starts
after that message gets them in its brief (`childImagesOf`: the images of the accepted user rows
of the tree's generation up to the delegation); the child pane names them as chips. An image that
cannot be written refuses the message with "Auto could not keep the images. Attach them again.":
nothing is dropped silently. A turn that is not an operator message or
a child is left to the plain turn. A message to the root of an Auto tree is never a
plain turn: with no Auto door registered at all (the runtime has not started yet)
`routeAutoUserTurn` refuses it with "Auto is not running yet. Send it again in a
moment." and the composer keeps its text.

## Overview

An Auto tree is one row, like any agent row: its state in the row word and the
cost of the whole tree. The word follows the tree phase:
**Deciding what to do**, **Starting agents**, **Waiting for Implementer and
Tester**, **Needs you**, **Reading the results**, **Blocked, open the
chat**, **Stopping**, **Stopped by you**, **Idle**, **Finished by you**. The
children are not rows of the Overview; they live in the Auto tree of the Agents
panel.

Auto never finishes itself. A tree that rests after its agents settled (stored
phase `done`) reads **Idle** in the row and the rail root, never Done. **Mark finished** in the agent menu
(`agent.markAutoFinished`, undoable) moves a resting tree to the stored phase
`finished` (m231) through `moveRestingAutoTree`: one write that needs a resting
phase, no stop, no running turn and no open delegation, so a tree that started
working again refuses with "Auto is working again. Mark it finished once it
rests." A finished tree is left out of recovery and takes only user messages:
writing to it reopens it to **Deciding**.

## The chat

- **The tree in the Agents panel.** What Auto spawned lives in the Agents
  panel of the session tools ([navigation/session-rail.md](navigation/session-rail.md#the-session-tools)):
  opening Auto agents or an Auto agent opens it, and it follows an Auto agent
  or one of its children in the center. The tree sits on the Activity rail
  with Auto at the bottom and one row per child above it, ordered by when Auto
  started them, newest on top, in the list of launches and in a focused launch
  alike (one `SpawnedAutoGroup`); a child that starts while you read lower
  moves in at the top without moving your scroll or focus; a live tree opens, a
  settled one folds to Auto with its count of children
  ([navigation/session-rail.md](navigation/session-rail.md#the-session-tools)). Auto is titled by the
  first line of the ask it started with (`autoRootTitleOf`), which the tree
  view carries (`AutoTreeView.rootAsk`, `readFirstUserText`) so no transcript
  has to load. The ask is the root's first `operator_text`, else its first
  `user_text` not marked `deliveredBy: 'auto'`, never the delivery Auto builds
  (whose first line is the artifact ledger header); then the transcript brief,
  then "Auto". A row is one line: state node, role glyph, name
  and the time; its accessible name says the role, the name and the state
  word, and its fact card (`railRowCardOf`) gives the name, the
  state, the task Auto gave, the provider, the model and the effort as rows.
  While Auto has no child it shows Auto alone ("Idle"
  before a tree exists) and "No agents started yet". Every state word is gray beside its toned node and comes from
  one word map (`autoTreeWordOf` for Auto, `delegationCardOf` for a child):
  **Needs you**, **Running**, **Idle** (gray dot), **Done** (green check),
  **Stopped**; the Auto agents list reads the same words.
- **Changing the limit.** The Auto page's settings line (`AgentSettingsLine`)
  holds **Limit** "$0.85 of $5.00 from Harborline" (`autoLimitWordsOf`: the
  source names the winner, "this Auto" once you set its own, and the popover's
  last line reads the chain, "This Auto $5.00, then session $8.00, then
  Harborline $5.00. $5.00 comes first."). Its popover takes an amount and applies
  it on Enter or when it closes (`AutoLimitSetting`), also while the tree runs,
  with **Undo** in the toast; **Raise limit** on the tail opens it
  (`autoLimitOpenEvent`). An amount over a session budget that pauses, or a
  blank field while one exists, says the session limit comes first. A session
  budget that only warns does not count here (`AgentSettingsLine` reads it
  through `pausingSessionCapOf`), so the source and the chain name this Auto or
  the workspace and a raise over it goes through. An amount under spent
  plus reserved is refused by the write.
  `setAutoTreeCap` (`store/runtime/auto/setAutoTreeCap.ts`) writes it in one
  statement that compares the cap it read and checks spent plus reserved in the
  same write, so a reservation cannot slip in between; a lost compare says "The
  limit changed in another window." and a failed save keeps the popover open with
  "Couldn't save the limit. Try again." under the field. It leaves `phase_rev` alone, so a running
  turn keeps its next step, then drives the tree, so a tree paused at the limit
  resumes after a raise. The cap changes only this conversation; the workspace
  cap stays the start value of the next one.
- **No limit.** A blank amount is **No limit**, stored as a NULL `cap_usd`
  (m231), never a sentinel. The chip then reads what is spent, and the prompt
  line says "no cap" and
  never prints a left. The root turn claim and child admission pass a NULL cap
  (`autoBudgetCoversSql`), and the gates read it as unbounded
  (`autoRemainingForGates`). A child has no dollar ceiling of its own, with or
  without a limit: it runs until it is done. While a session budget exists, No limit is
  refused: the session limit comes first. A tree is only created with a number; NULL
  comes only from this choice.
- **The page.** The header is the goal as the title and the provider mark, with
  no role, Experimental or state chip; **Mark finished** shows there as a
  word only while Auto rests and its own turn is not running (the registry verb
  `agent.markAutoFinished`, left out of the `⋯` then so it is said once), next
  to `⋯`, which holds **View transcript** (`agent.transcript`) and **Rename**.
- **Delegation lines.** Each delegation is one bare line in the conversation
  (`AutoDelegationLines`): its role chip, the task Auto gave and **Open**; the
  lines after one reply share one list (`mergedBatchesOf`). A revision is the same producer with "revising v2", then "v2
  ready". The child's state word is on its rail row, never on the line; its
  reason, model and result are in its pane. Lines read the
  delegation, attempt and agent rows, never the message text, so a reload draws
  the same lines. A revise that waits for an OK carries **Confirm** and
  **Cancel** under its line ("Revise <plan> to v2?"), and a plan that waits for approval carries the
  ask **Plan v1 needs your approval** with the plan title (opens the plan),
  **Ask for changes** and **Approve plan** (`AutoPlanAsk`, the same
  `useAutoPlanApproval` the plan drawer uses). While the plan is revised the ask
  settles to one quiet line, "Plan v1 · changes asked".
  An artifact that needs no approval has no row on its line: it shows once, on the
  result card (see **What the agents reported**).
- **Where a line sits.** A batch goes before the first message sent after it
  settled, and an open batch goes at the end.
- **Names.** A child is named by what it does. Auto gives each child an
  optional `title` of at most eight words in the delegate block
  (`DelegateChildSpec.title`, cut to `DELEGATE_TITLE_WORDS`, stored as
  `request.title`, part of the request hash only when set, and a retry keeps the
  title of the work it repeats). Without one the name is the first sentence of
  `request.task`, heading lines skipped and cut at a word end near 60
  characters (`taskTitleOf`). An old row with neither falls back to the role
  noun, numbered in the order Auto started them when a role has two or more,
  **Reviewer 1** and **Reviewer 2** (`autoChildLabelsOf`, adopted agents left out
  of the numbers). The role stays visible as its glyph, with the noun in its
  tooltip and accessible name. The rail row, the Agents drawer, the delegation
  line, the result card and the delivery text Auto reads all take the name from
  that one function, so Auto and the screen say the same name. A stuck child is a Next card headed by its branch and
  pull request ("Auto is stuck" only when its branch is unknown) whose
  sentence names the role, never the quoted ask: `The scout never started.` (or
  `failed.`, `timed out.`, `is blocked.`, one verb per child state from
  `autoStuckKindOf` and `autoStuckVerbOf`; a blocked child stays a
  `childBlocked` target, never folded into failed), then the sentence its
  reason code maps to (`delegationReasonTextOf`), never a blocked child's own
  words, which can be in another language, until the agent text plan gives
  each child a one-line summary in your language. Its verb reads **Retry**
  with the accessible name `Retry "<name>"`.
- **Why a child stopped, and what a done child said.** The second line of a
  stuck child on the rail and in the Running card is its reason in
  words, never a code like `declared_blocked`: a blocked child's own summary
  from `delegation.result.declared.summary`, else the sentence the reason code
  maps to (`delegationReasonTextOf`, shared with the result card), else
  nothing. A done child shows the result it declared in `delegation.result`,
  then the summary Auto accepted, never the working `outputSummary`, and no
  "Auto asked:" line (`autoGroupOf`, `autoChildCopyOf`). While a child is stuck
  and Auto is live, the Auto row reads **Stuck**, the same word as the Running
  card (`AutoGroup.isStuck`), not Auto's own phase.
- **Stopped and replaced children are not stuck.** A delegation that settled
  `stopped` (you or Auto stopped it, or you declined its start, reason
  `declined`) is the child state `stopped`, which `autoStuckKindOf` does not
  count: it leaves Next and the Running card's stuck actions, reads **Stopped** on the
  rail, and shows among the latest finished items of the Done card and in
  the full log, with **Retry** in its detail (`doneRowsOf`, the same continue
  as the Next retry). A settled
  child that did not complete is superseded, state `retried`, when a later
  delegation takes the same role on the same branch (`target.mountId`), with or
  without `retryOf` (`autoGroupOf`).
- **A child that left the session is not stuck.** When a child's agent row is
  deleted (`deleted_at`) or now belongs to another session, the read of the
  Auto trees leaves its delegation out, together with the failed attempts its
  retry or a later same-role, same-branch delegation replaced
  (`listGoneAutoChildIds`, `presentDelegationsOf`, in `readAutoTreeViews`).
  The agents of those left out attempts go into `hiddenChildIds`, so an
  earlier attempt whose agent is still in the session does not come back as a
  linked child (`autoGroupOf`).
  Every reader of `autoTreeViews` (Next, the Running card, the Done card,
  the rail, the Agents drawer, the counts) sees the same list, so none of them
  shows a card for it, and a moved child belongs to the session that holds it
  now. A child whose agent row does not exist yet (accepted, not started) stays.
  A **Retry** clicked after the child left reloads the trees, sends nothing and
  shows "This agent is no longer in this session. It was deleted or moved." on
  the card (`useActionCardActions`).
- **What the agents reported.** Each child result Auto read for a turn is that
  child's card, right after the **What Auto was told** row of that turn and
  before Auto's reply (`AutoDeliveryResults` under the delivery row, drawing
  `AutoResultCards`): the role glyph, the name, the model
  with its provider, the state word (`settledStatusOf`, the rail's words) and
  **Open**, which opens the child pane. The body is the child's own report in
  `ClampedProse`, three lines then **Show more**; a failed, stopped or timed out
  child shows its card with its state and no body. When the child produced an
  artifact (`deliveredResultsOf` reads the `artifacts` of the result entry), the card leads with
  the same artifact rows as the delegation lines and the agent's own prose goes behind **Show the
  agent's notes**, closed by default (`AutoResultNotes`, artifact blocks dropped by
  `summaryProseOf`); a plan that waits for approval has no row on the card, its ask is on the
  line, and a card whose child produced no artifact keeps the three line preview. The cards read data, never
  Auto's prose: an accepted `results` row of the outbox keeps the root run that
  read it (`accepted_run_id`), `readAutoTreeViews` reads those rows as
  `deliveredResults`, and the delivery row of the transcript (the `auto_delivery`
  item keeps the `runId` of its event) draws only the results of its own run. A
  result whose delivery row is not in the transcript is not drawn, never moved
  to the end, so a late result stays with the turn that read it; a reload and a
  second window read the same rows.
- **The tail.** Auto's state is said once, on the tail at the end of the
  conversation (`AutoTail`, phrases from `autoTreeLive`): **Waiting for
  Implementer and Tester** with **Change approach** and **Stop Auto and its
  agents** (just **Stop** while no child exists), **Starting agents**, **Reading the results**, **Deciding what to do
  next**, a refused hand over in the user voice, **Paused at the limit: $4.80
  of $5.00** with **Raise to $10**, **Change limit** (opens the Limit chip's
  popover on the Auto page) and **Stop**, plus a line on the agents still
  running when there are any, **Blocked: <reason>** with **Retry** and **View
  transcript** (a block at the budget offers **Raise limit**, **Change limit**
  and **Stop** instead, one at the time limit only **View transcript**). Only `deciding` reads
  **Deciding what to do next**: a resting tree (`answering`, `done`, `finished`)
  whose turn ended draws no tail and no Stop, the rail says Idle or Done and
  **Mark finished** is in the header. A Stop or a Retry that fails says why on the
  tail itself, in an inline danger notice under the line ("Couldn't stop the Auto
  agents", "Couldn't retry Auto"), never only in the notifications. While Auto's own turn runs, the
  thinking line of the conversation speaks instead, and while a plan waits for
  approval the ask is the state. The composer says "Message Auto" while Auto
  waits, or "Message Auto, or describe changes to plan v1", and shows **Ask
  first** like any agent composer.
- **A child opens in the pane** (drawer kind `auto-child`, `AutoChildPane`)
  from its rail row or its line's **Open**, so Auto's conversation stays in
  view; another child swaps in place, the Auto row of the rail closes it, Esc
  closes it, and its rail row is the selected one. The pane title is the task
  Auto gave it (the role when the task is missing); on top, why Auto chose that role, the model it runs on with its
  provider (no dollar amount: a child holds no money) and the note when the app changed
  the model (`AutoChildBrief`); then the child's conversation; at the end what
  came back (summary, files changed, checks with their source, open questions,
  `DelegationResult`; the summary is markdown through the shared `Markdown`,
  with any artifact block dropped by `splitArtifactText`) and its tail (`autoChildLive`: **Queued** only while Auto has
  accepted it and not started it, its live line with **Stop agent**, **Waiting for
  your OK** with **Confirm** and **Decline**, **Asked a question** (the question is in the
  conversation above), **Failed: ...** or **Stopped** with **Retry through Auto**, or
  **Returned to Auto**). A pane opened from the Agents panel shows **Back to
  agents**. **Open full** puts the child in the center; there the notice reads
  the same and **Open Auto** goes back.
- **Talking to a child.** The pane and the child page carry a composer,
  "Message Implementer", under the line "Started by Auto. Auto sees what you
  tell it." A message is a plain turn on the child (queued while its turn
  runs), and `noticeAutoOfChildTurn` (called by `sendTurn`) also hands Auto a
  note through the user turn port: "I wrote to the Implementer you started:
  ...", read with Auto's next delivery. A lost note is reported and the
  message still goes to the child. The drawer composer names its agent: `ChatView`
  hands its `agentId` to `ChatInput`, which keys the draft, the queue, the
  attachments, the routing and the send by that id and remounts per agent, so a
  child's draft never shows in the main Auto composer, two children never share
  one, and a send or a Queue or Send now reaches the child (a stopped or done
  one takes the turn through the normal resume path). The store's selected
  agent of the session is Auto's root and is not the drawer's target.
  **Retry through Auto** asks Auto to continue
  a stopped child, naming its delegation so Auto sends `retryOf` and the same
  agent goes on in its worktree; it never runs a plain turn on it
  (`docs/turns.md`, resume rules).
- **No permission picker in the tree.** The composer of Auto and of its
  children hides the session's permission mode picker: a tree member runs
  with its role's access, not the session mode.

## Plans

The plan a Planner writes opens in the right drawer. Its second row shows
**Needs approval**, **Approved** or **Revising to v2**, the version, **Ask for
changes** and **Approve plan**. Approval belongs to a revision: **Approve plan**
is a compare and swap on the version the drawer shows, then Auto is told once
("Approved plan v1."). A newer version, a revise in progress, a used plan or a
discarded one refuse it with a sentence and the drawer stays open. A second
click, or a second window, on an approved version does not tell Auto again.
Auto cannot start a writer role (Implementer, Tester, Docs, Scribe, CI fixer,
Rewriter) on a plan that is not
approved. The policy is `isAutoPlanApprovalRequired`: the runtime reads the
stored setting `agents.autoPlanApproval` on every tick, and approval is required
unless the stored value is exactly `false`. There is no screen for that setting
yet. **Ask for changes** opens the chat of Auto: a change written there makes Auto
rework the same plan into the next version.

A writer admitted with a plan marks that plan used in the admission
transaction; a reader role (Reviewer, Scout) leaves it ready. The SQL write
does not reach the store by itself, so `delegate` calls the
`refreshSessionArtifacts` port after an accepted or replayed admission, and
`landAttemptRevision` calls it after a revise lands (the revise turn skips the
usual capture). The port (`store/runtime/auto/makeRefreshSessionArtifacts.ts`)
reloads the plans and artifacts of the session the grant names and reports a
failed read without undoing the admission. It also emits
`goodboy:auto-artifacts-changed` with that session id on the Auto bridge bus;
a detached window listens through `followArtifactAnnouncements` and reloads the
session when it shows it. Every loader of `sessionPlans` and `sessionArtifacts`
claims a read from `sessionReads` (see
[typescript/state-writes.md](typescript/state-writes.md) → Latest only), so a
session load that answers after the admission refresh cannot bring the plan
back, and an Auto refresh that answers after a saved edit cannot undo it.
Without this the Next box keeps offering **Start implementer** on a used plan
until the session is reopened.

## Confirming

A revise Auto is not sure about waits for an OK under its delegation line: "Change plan
Retry-safe credit retries at v2?" with **Confirm** and **Cancel**. The answer
goes through one port, `registerDelegationDecisionPort`, which the runtime
registers; without a port the click says Auto cannot take the answer yet.

## Blocked and Retry

A tree is blocked when a guard stops the next delivery (three answers in a
row with no progress, the time limit, the budget), when the provider refuses to
start Auto's turn, or when Auto stopped answering: a tree still deciding 10 minutes
after its delivery (`AUTO_STALE_DECIDE_MS`) with no live root run settles from what
the run left behind, or, with nothing stored, blocks with "Auto stopped answering
before it replied. Retry to send the message again." and puts the message back.

A blocked tree writes nothing while it waits. It resumes by itself only after a
budget block, once the limit is raised. Otherwise **Retry** on the tail
(`retryBlockedTree`, through the retry port) resumes it: it clears the reason,
resets the no progress streak and redelivers what waits. Past the time limit or at
the budget it refuses with the reason on the tail. A message from the user to
a blocked tree is a Retry too, and the first recovery after a restart retries a
block that no limit caused.

## What stops an Auto tree

No fixed count of agents, runs or turns ends a tree or refuses a hand over. A tree
that already delegated 12 agents, ran 20 attempts or took 30 turns keeps going. What
stops it is a guard that protects the user:

- the spend cap of the tree (none, or the limit the user set
  and raises), checked against real spend: settled cost plus what running children
  spent so far (`autoLiveUsdSql`, their telemetry). No money is held for a child and
  no child has a ceiling per role: a child is admitted while the limit has money
  left (or there is no limit) and runs until it is done. Only Auto's own answer
  holds `AUTO_TURN_CEILING_USD` (and an aux job `AUTO_AUX_RESERVATION_USD`), so
  Auto's turn never starts with less than that left. A child that reports no cost
  settles at 0 with its cost marked unknown, never at a ceiling; its result says
  "cost unknown". Old attempt reservations from before this rule are read as
  holding nothing;
- `AUTO_TREE_LIMITS`: delegate calls per turn, refused hand overs, question cycles
  per delegation, the no progress streak and the wall clock hours;
- four open children and four per batch.

Deleting the root agent of a tree first runs the stop protocol on the tree (`stopAutoTreeForDelete`,
through the tree stop port and `stopTree`): the generation advances, every running child is
cancelled and the stop is confirmed only after that cleanup succeeded. If a child does not exit,
Auto is not running or another window owns the tree, the delete fails with the reason, the agent
stays and the tree stays unconfirmed; deleting again resumes the stop. The purge itself
(`agentPurgeStatements`) never touches the tree. The lists read only trees whose root agent is
still in the session (`liveAutoViewsOf`, through `useAutoTreeViews`): a tree
left open on an agent that was deleted or moved raises no **Needs you** card, no **Auto is stuck**
line and no count. A child whose agent is gone is not stuck (`isAutoChildStuck`); a child Auto
accepted and has not started has no agent yet and still counts, and so does one whose agent could
not be created (reason `agent_not_created`, `launchChildren`): its failure and retry card stay. Plans stay readable in the plan
list.

The limit never throws away work. At the limit no new child is admitted and
Auto's next turn waits (`turnGate`, blocked with the budget reason), but nothing
running is stopped: a child that runs keeps running, finishes its turn and settles
as usual, with its commits, files and result kept (pending in the outbox). Its
spend can go past the limit; the tail says so ("No new agent starts. The 2 agents
still running finish their work and can spend past the limit."). A child paused on
a question is never timed out while the tree is blocked (`enforceDeadlines`), and
leaving the block gives every paused child a fresh delegation deadline
(`pausedDeadlineStatement`), so Auto can still answer it. Raising the limit drives
the tree: the waiting results reach Auto in one turn and the tree goes on where it
paused; a raise that still does not cover Auto's turn keeps it paused with the
results kept. With no limit the tree never pauses on money.

A child that ended stopped, timed out, failed or blocked keeps its worktree and
its partial output. Auto's prompt tells it to continue such a child with
`retryOf`: the retry runs on the same agent and the same mount, its kickoff says
the work so far is in the worktree and to continue, not start over
(`retryNoteOf`), and its first attempt carries the baseline of the stopped one
(`carriedSnapshot`), so its result counts the commits made before the stop. Only a
retry of a completed child starts the task again from the start.

Time never cuts a child that works. A running child has no wall clock deadline: it
is stopped only when its agent shows no output and no tool activity for
`AUTO_CHILD_IDLE_MINUTES` (30 minutes, a hung CLI), read from the `turn_events` the
app records for that agent (`enforceDeadlines`, `readAgentLastEventAt`). The quiet
time counts from the last event, the attempt start or the start of the app,
whichever is latest, so an old row whose `deadline_at` passed while the app was
closed is never expired on load. A tool call that started and has not ended
(`hasAgentOpenToolCall`, a long build or test run) counts as activity, bounded by
the CLI's own tool timeout. Such a child settles `timed_out` with the reason
`no_activity` ("It showed no activity for 30 minutes and was stopped. Its work is
kept.") and Auto continues it with `retryOf` as above. A child paused on a question
keeps its delegation deadline.

At the spend cap the tail reads **Paused at the limit** with **Raise to ...**,
**Change limit** and **Stop**; raising it drives the tree again, nothing else to do. The counters
`delegations_used`, `attempts_used`, `turns_used` and `grants` stay in `auto_trees`
(no migration): the first three only count and show, `grants` is no longer written
or read. An old tree with its counts at the old cap resumes as it is. The prompt
tells Auto the spend left (`autoBudgetPromptLine`), never a count of agents left.

## How Auto decides

Auto runs read-only on every provider that can confine it: the same role access scouts and reviewers get
(Claude with `--tools Read,Grep,Glob` in plan mode, Codex `-s read-only`, Cursor `--mode plan`, and so on). It
has no shell and never calls Goodboy from inside its turn, so there is no bridge command, no
capability token and no allow rule. It decides by ending its final reply with at most one block:

```
<<auto>>{"action":"delegate","requestId":"r1","children":[...]}<</auto>>
```

- `delegate` hands one to four children to agents of a role (`requestId` is optional and
  derived from the run when missing; `children` is the spec `parseDelegateSpec` validates).
- `answer` answers the question of a child (`delegation`, `question`, `text`, and an optional
  `artifact` id whose text Goodboy puts into the resume, see Substeps).
- `finish` says the work is done (`summary`). It is refused while an agent is open or a result
  waits. It stores nothing: the tree still rests as Idle until the user marks it finished. The
  prompt asks Auto to suggest **Mark finished** and to send `finish` only when the user asked to
  close.
- No block is a plain answer to the user.

After the routing table the prompt renders **WHEN TO ADD A ROLE** from `packages/core/src/roleNeeds.ts`
(`roleNeedsSection`, driver `auto`): per role a reason the root can see and a "do not add it when".
The default is one implementer with nothing added, a "do not" beats a reason, and a force push
always brings a reviewer. The rewriter, scribe and CI fixer rows exist for Auto only. The
delegation rules add "decide once before you fan out": when two or more writers would get the
same task on different branches, one writer or a planner decides first and each writer gets the
decision in its task. These are prompt rules, not enforcement: a test proves the prompt holds
each row, not that the model follows it. The Orchestrated prompt renders the same table filtered
to its roles ([workflows.md](./workflows.md) → Step sequencing).

The system prompt (`packages/core/src/auto/prompt.ts`) carries the role list and a routing table,
**WHICH ROLE FOR WHICH WORK**, generated from `AUTO_ROLE_WHEN` (one line per Auto role, so a role
cannot join without one): diagnosing a failure goes to an Investigator, tests to a Tester, text
about code to Docs, code changes and their commits to an Implementer, the pull request to a
Scribe, a failing check to a CI fixer, the commit history of the branch to a Rewriter. Scribe, CI
fixer and Rewriter are writers (m232 widens the role CHECK of `auto_delegations`; Rust
`WRITER_ROLES` holds them). A Rewriter child cannot start: its turn needs the copy the History flow
prepares (`leaseTurnWriter` throws without a `historyRewriters` binding), so `resolveDelegateChild`
refuses the role with `spec_invalid` before any agent exists and tells Auto to use an Implementer with
`publish: {mode: "force"}`: Goodboy checks the tree, keeps a backup and asks the user to confirm the
force push, and does not check each rewritten commit. A Scribe child writes `<<pr-title>>` and `<<pr-body>>` and never runs
gh: when it ends completed, `finishAttempt` calls the `publishScribePullRequest` port, which goes
through `resumeScribePullRequest` and `openScribePullRequest`, the path the Branch page uses
(draft, the repository's base, never a second request when the branch already has one). The
result Auto reads starts with "Pull request #421 is open: <url>"; a failure fails the delegation
with the reason, and a retry of the same child opens it once. It names the `mount` field of a
child and the MOUNTS line it is filled from. Auto keeps its read tools and answers questions
itself; when it reports what happens next it describes a hand over and names the role ("I asked
an implementer to reinstall the dependencies"), never an action of its own. The brief of every
writer child carries `AUTO_DEPENDENCIES_RULE`: install missing dependencies with the project's
package manager in its own mount, never link or copy `node_modules` from another checkout.

Only a writer role has a shell; Scout, Planner, Investigator and Reviewer run with `Read,Grep,Glob`
(`READ_ONLY_ROLES` in `cli_args.rs`). `packages/core/src/auto/roleTools.ts` holds that fact for Auto:
each role line of the prompt says whether the role has a shell, and the prompt rule says a task that
runs a command goes only to a role that does. `resolveDelegateChild` enforces it: a read-only role
whose task or done-when line names a command (`git log`, `git ls-remote`, `pnpm test`, "run the
tests") is refused with `role_lacks_shell`, the message lists the roles that can run commands, and
nothing is written, so Auto chooses again in its next turn. There is no read-only shell role yet:
a read-only check goes to a writer role with "read only, change nothing" in the task. A child that
ends blocked and says it had no shell tool gets the reason `missing_tool` (not `declared_blocked`),
and its result carries the line that tells Auto to hand the same task once to a role that can run
commands instead of reporting the block as the answer. The reroute is Auto's own next hand over,
checked by the same refusal, not a second child started by the harness.

**Branch facts for a scout.** A scout cannot run `git log` or `gh pr view`, and giving a read-only
role a shell would give the Auto root one too (they share an argv). Instead a scout spec may carry
`"facts":["<mount id>"]`, up to `AUTO_FACTS_MOUNTS_MAX` (4). `resolveDelegateChild` calls
`gatherBranchFacts` before the kickoff is composed: per named mount the `readBranchFacts` port reads
the commits since the base branch, the pull or merge request of the branch, its open review threads
and its checks, on GitHub, GitLab and Bitbucket alike (`makeBranchFactsReaders` goes through
`pullRequestPortFor` and the review source threads, the same functions the Branch page uses).
`composeBranchFacts` in core renders them as a `**Facts**` section of the brief, capped by
`AUTO_FACTS_CHARS` (6,000, split across the mounts) with per-list caps in `limits.ts`. A part the
host could not read becomes "Facts not available: reason" and the scout still starts; a read slower
than `AUTO_FACTS_FETCH_MS` (30 s) is cut and marked, and a late answer is dropped. A mount id that
is not in the conversation refuses with `mount_missing` and starts nothing; `facts` on any role but
a scout refuses with `spec_invalid`. The ids are stored in `request_json.facts` (no migration), so a
retry of the scout reads the facts again. The scout argv does not change. The facts are the state
at that moment, never a live view. The `role_lacks_shell` message and the reroute hint say that
branch and pull request facts go to a scout, not to a writer.

**A child reads its brief, not the session.** A new delegation carries `briefVersion: 2`
(`AUTO_BRIEF_VERSION`) in `request_json`; `launchChildren` hands it to the child turn and
`briefSlotsOf` (`store/slices/turn`) cuts the shared context of that turn to the goal slot: the
decisions, open questions, files touched and session summary are not sent. Profile, role, rules,
images and notes for the role are unchanged, and artifact bodies stay inline in the kickoff as
before. The prompt tells Auto to write each task as a self-contained brief of about 1,500
characters (goal, inputs, constraints, done when, report shape); the hard cap stays at
`DELEGATE_TASK_CHARS` (8,000), so nothing new is refused, and a revise is exempt. A spec may carry
`"decisions":["D27"]`: `resolveDelegateChild` reads the ledger (`listSessionDecisions`) and
`composeBriefDecisions` writes each active decision in full (cut at `AUTO_BRIEF_DECISION_CHARS`)
as a `**Decisions**` section before the task. An id that is replaced, withdrawn or unknown is named
as such in that section and the child still starts; a bare id in the task text is never expanded.
The ids are stored in `request_json.decisions`, so a retry writes them again from the ledger of that
moment. A retry or a resume keeps the version of its delegation: a delegation made before the
upgrade has no `briefVersion`, so its retries and answers keep the full slots. The Context
drawer says "Auto children read only their brief".

**The way back is an excerpt.** `parseChildClosing` keeps the answer of a child whole up to
`STEP_OUTPUT_EXCERPT_CHARS` (4,000, the budget the Runs excerpt owns) and above it the same
head and tail cut Runs use (`excerptStepOutput` in `summarizer/step-output.ts`, no model call),
with the line "[middle dropped, the full text is in the step transcript]" between; the last line
survives. The blocked status and the blocking question are read from the whole answer before the
cut, so a dropped middle never hides them. `DELEGATION_SUMMARY_CHARS` is the same number. A writer
(implementer, tester, docs, ci-fixer) may attach its long report as a `report` artifact: the kickoff
expected text says so, `finishedPlain` registers what the child wrote, and a writer that wrote none
is not failed (`artifactPersistence` is `not_applicable`).

**Answering a child that cannot resume.** The resume text of a paused child (`composeAnswerKickoff`)
is the question and the answer. A provider outside `AUTO_RESUMING_PROVIDERS` (`isAutoProviderResuming`,
Claude only; Codex drops the session id in `cli_args.rs`) starts the second attempt with no memory, so
`kickoffTextOf` in `launchChildren.ts` puts the stored first kickoff (`request_json.kickoff`) and
"Where you stopped", the excerpt the paused attempt stored as `result_json.tail`, before the question.
`answerQuestion` copies that tail into the `resume` baseline of the new attempt, so a replay of the
same answer, a restart and `recover` write the same text. Claude children keep the short text.

**Substeps.** A child that cannot go on without a scout or an investigator adds
`needs="scout"` or `needs="investigator"` to its blocking question (`parseSubstepNeeds` in
`core/auto/substep.ts`, read by `parseChildClosing`; any other value is dropped). The attempt pauses
as for any question, and the question row, the digest line and the resume baseline keep `needs`.
There is no new verb and no new admission caller: Auto, in its own deciding turn, either answers the
question or delegates the helper with `"forQuestion":"<question id>"` in the spec of a scout or an
investigator (`DelegateChildSpec.forQuestion`, part of the request hash; a retry cannot carry it).
`resolveDelegateChild` finds the delegation paused on that question
(`getPausedAutoDelegationOfQuestion`), stores `request_json.parent` (`delegationId`, `questionId`,
`depth`) and gives the helper a kickoff without the ask rule (`isSubstep`). Admission refuses, in
`core/auto/substepAdmission.ts` and again in `autoSubstepStatements`: `not_paused` (the parent is not
paused on that question, or is unknown; only its latest attempt counts, since an answered pause
stays a `paused` attempt row behind the resumed one, so a question already answered never admits a
helper and the lookup, the snapshot and the guard all read the attempt of the highest ordinal),
`generation_changed` (the parent's generation is not the tree's), `role_mismatch` (a role other than scout or
investigator), `depth_cap` (the parent is itself a substep: `AUTO_TREE_DEPTH` is 2, root child 1,
substep 2), `substep_cap` (a parent has `AUTO_SUBSTEPS_PER_PARENT` = 2 helpers, settled ones counted,
and the same batch counts). A user message bumps the generation first, so the admit comes back
`generation_changed`.

A paused delegation no longer counts as open: `autoAdmissionTreeStatement` and
`autoResumeTreeStatement` count `state NOT IN ('settled', 'paused')`, and the snapshot's `openCount`
does the same. Four paused parents can each get a helper. The resume of a parent checks a free running
slot (`breadth_cap` from `diagnoseResume`, the same guard in SQL), so the helper's slot passes back
to the parent; a refused resume leaves the child paused and the answer is sent again once a slot frees.
Admitting a helper moves the parent's deadline to the helper's deadline plus
`AUTO_SUBSTEP_PARENT_SLACK_MS`, in the same transaction, so a waiting parent is not expired. Cost per
ask: one delegation and two attempts from the tree's counters and budget; the digest and the question
block say so (`substepNeedsLine`).

When the helper settles, Auto answers the parent. `answer` takes an optional `artifact`: if it is an
artifact of this tree, `answerQuestion` stores its title, version and text (cut at
`AUTO_DELIVERY_ARTIFACT_CHARS`) as `report` in the `resume` baseline and `composeAnswerKickoff` writes it
as "Report handed over"; an unknown artifact is refused `artifact_unknown` and the parent stays paused.
A failed helper is answered with a plain text. The same answer twice is one resume. `stopTree` cancels
the helpers (a request with `request_json.parent`) first and waits for them before it cancels the
rest. A restart keeps the parent paused and the helper running through `recover`. The Agents
panel tree (`railRowsOf`, `autoSpawnedRowsOf`) draws a helper one level under its parent (`depth` 2,
one `aria-level` deeper, the parent `aria-expanded`); a helper whose parent is not in the tree reads
as a plain child. Substeps inside Runs and Orchestrated
runs are not built: they have no tree, no reservation and no root grant.

**Children never push.** Auto children run under one product rule: only Goodboy pushes, and only
after its own steps. The boundary is the query bridge. `readTurnStream` marks the spawn of a child
(`isAutoChildTurn`: origin `delegation` and a confined role other than `auto`, which is the root)
with `isAutoChild`; `turn_spawn` records the pid of the process it starts (`spawn_turn` in
`query_bridge/auto_child.rs`) until the process ends, and `dispatch` refuses, before any host call,
every verb declared `Access::Publish` for a request whose socket peer descends from that pid. The bridge reads
the peer pid from the socket, never a run id the request carries: GitHub `push`,
`pr-create`, `pr-ready`, `pr-merge`; GitLab `mr-create`, `mr-approve`, `mr-unapprove`, `mr-merge`;
Bitbucket `pr-approve`, `pr-unapprove`, `pr-request-changes`, `pr-unrequest-changes`, `pr-merge`,
`pr-decline`. The child reads the code `auto_child_act` and "Goodboy pushes after its checks. Say in
your report what should be pushed." Reads, comments, thread replies and thread resolves stay open
(the task of a job like "resolve review comments"). A turn started by hand is recorded as hand
started and keeps every verb; any verb from a process that descends from no recorded turn is refused
`caller_unknown`. The env of every child also carries no git host token: `apply_git_host_access`
in `turn.rs` removes every name in `HOST_TOKEN_ENV` (`GH_TOKEN`, `GITHUB_TOKEN`, the GitHub
Enterprise pair, `GITLAB_TOKEN`, `GITLAB_ACCESS_TOKEN`) and never adds the workspace token, so the
publish step runs in Goodboy with Goodboy's credentials. Goodboy keeps Bitbucket credentials in its
own store and never hands them to a turn. A child reads pull requests, checks and threads through
the bridge, which still serves every read. Two
backstops sit behind the boundary and are not the boundary: the env carries a git config that
makes a push fail (`GIT_CONFIG_*`: pushurl `goodboy-blocked://auto-child` on `origin`, and a
`pushInsteadOf` rewrite of every `https://`, `http://`, `ssh://`, `git://` and `git@` URL, so any
remote and any URL fails; a test runs a real `git push`), and a Claude child gets the deny rules
`Bash(git push:*)`, `Bash(git push *)` and `Bash(*--no-verify*)`. A child with a shell runs as your
OS user: one that undoes the config on purpose, or calls `gh` or `glab` with your own CLI login, is
not stopped by the app; the remote watch below shows when the branch moved. The default done-when of an
Implementer ends with "Nothing is pushed." Scope: Auto children on Claude and Codex.

**Remote watch.** A push that slipped through is seen, not stopped. When a writer attempt launches
(`launchChildren.ts`, `attemptToLaunch`, a first attempt and a resumed one alike), the
`readRemoteHead` port reads the online sha of the checked out branch (`worktree_remote_head`, a
`git ls-remote origin`) and `attemptBaseline.ts` stores it in `baseline_json.remote` as
`{ kind: 'sha', branch, sha }`, `{ kind: 'absent', branch }` or `{ kind: 'unknown' }`. At the
settle, `finishAttempt.ts` reads the same branch again (the branch recorded at the start, not
whatever the child checked out) and `remoteVerdictOf` (`packages/core/src/auto/remoteWatch.ts`)
writes `result_json.verified.remote`: `{ status: 'unchanged' | 'moved' | 'unknown', branch,
before, after }`. A failed read on either side is `unknown`, never `unchanged`; a branch that
appeared or vanished online is `moved`. Read-only roles and attempts without a recorded baseline
carry no `remote`. The card shows "The branch changed online while this agent worked." or "Could
not check whether the branch changed online." and nothing for `unchanged`; the digest
(`renderDelegationResult`) carries the same two lines with the branch name, so Auto reads them.
The delegation outcome does not change. A repo without an `origin` reads `unknown` on every
writer. Failed and joined attempts (`failAttempt.ts`, `join.ts`) are not read: they carry no
attribution either.

**Changed files.** `result_json.verified.changedFiles` lists what a writer attempt changed, and
committed work counts. `attributeChanges` (`packages/core/src/auto/attribution.ts`) starts from the
uncommitted status snapshots taken at launch and at the settle, and for a writer adds the files of
the tree diff between the head recorded at launch and the head at the settle
(`readCommittedFilesOf`, port `readCommittedFiles`, the existing `worktree_diff_range` command,
`git diff <start> <end>`; `pathsOfPatch` reads the paths, a rename lists both sides). The diff
compares trees, not commit ids, so an attempt that rewrote history to the same tree lists nothing.
A head that did not move skips the read. If the diff cannot be read the list falls back to the
status files and `isComplete` is false. Read-only roles never read it; a change they make is still
the `role_read_only_violation`. The list is capped at 50 attempt files.

**Checks.** `result_json.verified.checksRun` holds the verdict of the project scripts the user
ticked as Auto checks: `green`, `red` or `not_checked` with a `reason` (`none_ticked`,
`check_missing`, `timed_out`, `tree_moved`, `tree_dirty`, `not_available`) and the `commit` the
scripts ran on; `verified.checks`
lists one `harness` row per script. The outcome stays `completed` whatever the verdict, so no
migration; `checksVerdictOf` and `checksTextOf` (`packages/core/src/auto/checks.ts`) own the verdict
and the one line the digest and the card print ("Checks green: typecheck, lint", "Checks red:
typecheck", "Not checked: timed out"). A script is ticked in the project settings, next to its pin
(`toggleAutoCheck`, settings key `scripts.autoChecks.<projectId>`, a JSON array of the pin ids of
`scriptPinId`; toggles of one project go through one keyed queue and read the selection only after
the previous save, so two quick ticks keep both and a failed save leaves the old selection; saved scripts and manifest scripts share the grammar). None ticked reads
`none_ticked`. A ticked script the branch does not have is never dropped: `listAutoChecks` returns
it under `missing` with its name (`missingCheckName`), `runAutoChecks` runs nothing and
`missingChecksOf` reads `check_missing` with one `unknown` row per missing script, printed "Not
checked: not on this branch: lint". `finishAttempt` calls `verifyAttempt` before it settles, only for a writer that ended
ok and closed with `done`: it pins the run to the end head that attribution read (`expectedHead`;
no end head reads `not_available`), so a run that waited in the queue while the head moved reads
`tree_moved` and runs nothing. `runAutoChecks` reads the status snapshot, refuses a tree with
uncommitted changes (`tree_dirty`), runs the ticked scripts one after the other through the
`listChecks` and `runCheck` ports (the real ones reuse the Scripts runner, so the runs show in the
Scripts page; exit 0 is `pass`, a positive code `fail`, a run that could not start `unknown`, and a
script past `AUTO_CHECK_TIMEOUT_MS` (5 minutes) is cancelled and reads `timed_out` only once its
process ended, so the queue never moves on while it runs; one still alive 30 seconds after the stop
marks its worktree, and every check there reads `unknown` without starting until that process
ends, which the user can force from the Scripts page), then reads the
snapshot again: a different head or any change reads `tree_moved` and drops the results. Runs on one
worktree path go through one keyed queue, so two checks of one repo never overlap, the settle's and
the rerun's alike. `unknown` and `timed_out` never read green. **Run checks again** on the card
(`rerunChecks`, forwarded over the Auto bridge to the main window with a 30 minute wait instead of
30 seconds) runs the same scripts against the recorded `commit`: if the head moved, the tree is
dirty or nothing is ticked any more the rerun is refused with a sentence and the old verdict stays;
otherwise `patchAutoDelegationChecksStatement` and `patchAutoAttemptChecksStatement` rewrite the
checks of the settled delegation and its last attempt in one transaction guarded by their
generation, so a late rerun of an older generation writes nothing. Offered only when
`canRerunChecks` (a commit is known, something is ticked, the tree was not dirty). A read-only role
is never checked.

**Publish.** A child never pushes (the bridge refuses it, see the push boundary above); Goodboy does
it after the work, like the scribe's pull request. A delegate child of role implementer or CI fixer
may carry `publish`: `"push"`, `"force"`, or `{"mode","reviewer","changesContent"}`
(`parseDelegatePublish`, `packages/core/src/auto/publish.ts`; a scribe or a read-only role is
refused `spec_invalid`, a retry cannot set it). It is stored in `request_json.publish`. At the settle
`finishAttempt` calls `planPublish`, which writes `result_json.verified.publish` (`ResultPublish`),
no migration, outcome still `completed`:

- The gate (`publishGateOf`) holds when the agent did not close with `done`, ended in error or has a
  `red` checks verdict; `not_checked` and no verdict pass. A held publish reads "Not pushed: the
  checks are red" and is retryable only for red checks.
- The pushed sha is `checksRun.commit`, else the end head. A plain `push` is never sent before the
  attempt settles: `planPublish` records it as `pushing` ("Pushing <branch> at <sha>") and the settle
  writes it. Then `pushSettledPublish` claims it in one guarded statement
  (`claimAutoAttemptPublishStatement`: the attempt still ended at its generation, the tree at that
  generation, not stopping, and owned by this window's lease) inside the per worktree publish queue
  (`publishQueue.ts`, shared with `publishAct`), and only a claimed record is pushed through the
  `pushBranch` port (the `pushBranch` store verb, `sha:refs/heads/<branch>`). A claim that fails writes
  "Auto moved on or stopped before the push, so nothing was pushed", retryable. The result lands on
  the attempt and, when the batch already joined, on the settled delegation
  (`followAutoDelegationPublishStatement`). `recoverTree` resumes a `pushing` record that was never
  claimed under the new owner, and turns one that was claimed when Goodboy closed into a retryable
  failure; the retry reads the branch online first.
- `force` first needs the online sha read when the attempt started (`baseline_json.remote`; unknown
  holds). It keeps a backup ref of that online sha, the commit the force push replaces
  (`history_backup_create`, kept stamp so the History prune never drops it), and a second one of
  the start head when it differs; a backup that cannot be kept (the online commit is not in this
  copy) holds with "Fetch the branch and try again". A branch that was not online at the start gets
  no backup and no **Put back**. It refuses work whose tree differs from the start
  (`readCommittedFiles` start to sha) unless `changesContent` is set. It then waits as
  `awaiting_confirm`: one **Force push** / **Don't push** row per delegate batch
  (`PublishConfirmRow` in `AutoDelegationLines`), one `publish` bridge call carrying every id.
- `executePublish` reads the online sha first (already the checked sha: pushed, nothing sent), then
  pushes the recorded sha itself, never the branch name or HEAD: `pushWithLease` sends
  `<sha>:refs/heads/<branch>` (`sourceSha`, `lease_push_args` in `github.rs`) with the lease on the
  recorded online sha, so a commit made after the checks is not pushed. On a failure it cannot
  classify it reads the online sha back before it writes anything. A lost lease reads the shipped
  "The online copy changed. Check again before force pushing." Any failure is retryable once
  (`PUBLISH_MAX_TRIES`). **Try the push again** always plans from the attempt's own commit (the
  record's sha, never the head of now) and the exit and completion stored in its result. A force
  retry reads the online copy again, keeps a new backup of it and waits for a new **Force push** with
  the new lease; a plain retry pushes the recorded sha again.
- `publishAct` (`confirm`, `decline`, `retry`, `put_back`) runs in the main window through one
  keyed queue per worktree, writes with `patchAutoDelegationPublishStatement` and the attempt twin
  guarded by generation, and answers one row per branch, so two of four branches can succeed.
  **Put back** pushes the backed up online sha (`leaseSha`) with the lease on the pushed sha first;
  a lost lease, or a failure whose read back does not show the backup online, changes nothing online
  or here and keeps **Put back** on offer. Only after the online copy is back does it move the local
  branch with the History restore, and only when the head is still the pushed sha; otherwise the card
  reads "Put back" with "The local branch was left as it is: " and the reason.
- Auto reads the line in the digest ("Pushed ...", "Not pushed: ...", "Waiting for you to confirm
  ..."). It is not sent again when a later click changes it.

`parseAutoBlock` (`packages/core/src/auto/autoBlock.ts`) reads only the settled text of a turn that
ended ok: it takes the last complete block, strips code fences, escapes raw line breaks in strings
and falls back to the last `}` when the close marker is missing. `store/runtime/auto/applyAutoBlock.ts`
runs at the top of `settleAutoTurn` and only for the current run of a `deciding` tree that is not
stopping, so a duplicate settle, a late settle after a stop and a recovered turn that passes the
same text admit once (the admission guards and the request id replay do the rest).

What Auto cannot say comes back as a message, not as a reply inside the turn. A refused spec, a
budget or limit refusal and a block that does not parse become a `refusal` row in the outbox,
delivered with the next turn under REFUSED, NOT DONE; such a turn counts as no progress, so
`noProgressStreak` bounds retries. A refusal row keeps the action, the code and the roles of the
refused children; while it is pending for the current generation, `readAutoTreeViews` reads it as
`pendingRefusal` and the tail says it in the user voice (`refusalNoticeOf`, reasons from
`AUTO_REFUSAL_USER_REASON`): "Auto tried to start an Implementer. Not started: more than one
folder fits and it did not say which. Auto is choosing again." A refusal about the project
(`mount_ambiguous`, `mount_missing`) is asked instead (`projectAskOf`, `AutoProjectAsk`): "Where
should the Implementer work?" lists the session's projects with their branch, **Another
folder...** opens a filter over the workspace's other projects ("Not in this session. A worktree
is created from main."), and the primary follows the choice (**Choose a folder** disabled, **Use
payments-api**, **Use both**, **Use 3 folders**) next to **No folder, just answer**, one
action row under the list, with **Discard request** as a quiet verb (the `projectAsk` kind of
the action registry, drawn by `ObjectActionVerb`). The composer reads "Pick a folder, or write
to Auto", so a reply in the chat answers too. The answer is a message to Auto through
`sendTurn` ("Use payments-api and ledger-core: start one Implementer per project."); a project not
in the session is mounted first (`ensureProjectMounted`, the button says "Creating a worktree for
notify-relay from main"), and a failure keeps the ask with the reason. The ask then collapses to
its answered line. Once Auto's next turn takes the
row, the line goes, and an admitted retry draws its delegation line. The mount of a child
(`pickAutoMount`): a named mount wins; a reader without one works in the tree's primary mount; a
writer without one goes to the only usable mount, is refused `mount_ambiguous` when more than
one fits (Auto never guesses a write) and `mount_missing` when none does. Before a writer is
refused `mount_missing`, `pickChildMount` lets it pick a folder the way a single agent does
(`mountTaskFolders`, the same rule as a new session's start, see
[mounts.md](mounts.md#who-picks-the-folders)): the workspace project its `mount` names, or, with
no mount named and none usable, the only repo, the repo of a linked task, or the repos its task
names by exact name. Inside the session's allowance they are mounted and the pick runs again;
past it a mount proposal waits for the user and the refusal says so. The refusal counters (`refusals_used`, the limit on refusals)
move once per generation and run, so a duplicate settle of the same turn cannot spend the limit twice. Each result line in a delivery starts with the name the user
sees on its card ("- Reviewer 2 (reviewer <agent id>, <delegation id>): completed"), and the
results block says the user sees each result as that card above the reply; the system prompt
tells Auto never to repeat or paste what an agent said, to name the agent that way and to write
only what it adds (what the results mean together, where they disagree, the next step, the ask).
Every delivery starts with a digest of the tree (open agents
with role, state and age, questions waiting, the budget, and a `MOUNTS:` line listing each usable
mount as `id (project, branch)` from `buildMountsLine`) and carries the artifact text of each
result, cut when long, so a provider that does not resume sessions still has its memory. The
`<<auto>>` block is hidden in the transcript like the other markers; the delegation lines show
what it did. See [query-bridge.md](query-bridge.md) for the bridge Auto does not use itself and
refuses to its children for the acts above.

## Providers

Auto itself runs on Claude, Codex, Cursor, Gemini and Copilot (`AUTO_OWN_PROVIDERS`), because it only reads
there. It never runs on the opencode family (opencode, OpenRouter, Moonshot,
`AUTO_UNCONFINED_PROVIDERS`): the `plan` agent of opencode denies edits but asks before a shell
command, and Goodboy always passes `--dangerously-skip-permissions` to opencode, which approves the
ask, so a read-only turn there could still run a shell. Whether opencode can run without that flag
and deny the ask is unproven, so Auto is kept off it instead. Three layers hold the line: the
composer lists only `AUTO_OWN_PROVIDERS` and shows "Auto needs a connected provider" when nothing
else is connected; `kindRouting` for Auto never resolves to the family (the role default, a stored
role pick and the model of the chat are all skipped) and `spawnAgent` refuses an Auto agent on it;
and `turn_spawn` refuses the role `auto` on an opencode binary (`ensure_confinement`). Its children run
on Claude and Codex, never on Cursor, Gemini or Copilot, which cannot confine a role
(`AUTO_CHILD_PROVIDERS`). The pool of a tree is the run
pool when there is one, else the workspace pool (the providers the workspace
policy on the Models page does not turn off), else every allowed provider
(`autoChildPool`, `runProviderPool`).

## What the screens read

The screens read the registry through the `auto-view` slice
(`loadAutoTrees`), which polls every 2 seconds while a session has an Auto
agent or a tree that is not finished. Nothing pushes tree changes to a window
yet. The numbers on screen come from the budget function the prompt and the
admission use, so they agree. What is left has one SQL formula
(`autoRemainingUsdSql`, read by `readAutoTreeSpend` and by every admission
check) and one JS formula (`autoTreeSpendOf` in core, used by seeds, fixtures
and the delivery line); nothing else subtracts. The budget line of a delivery
is built before the claim reserves the turn's 0.50 USD, so it counts that
hold itself and names it ("Held 0.50 USD for this answer. Left 0.68 USD."): the
Left Auto reads equals the rail's Left while that turn runs. The line never
speaks of money reserved for agents, since none is. A delivery retried after a failed start reuses its stored text.
