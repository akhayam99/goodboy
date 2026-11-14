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

One app-wide setting, **Work (experimental)** (`SETTING_WORK_ENABLED`, under
Experiments on the General page, off by default), moves doors, names and
engine rules, never views. Off: no Work section, the word Auto, "Start a run"
opens the router, the level chip. On: Work, the word Lead, one composer,
permission rows. `flowWordOf` (`shared/lib/flowWordOf.ts`, read through
`useFlowWord`) is the only place that picks Auto or Lead, aria-labels
included; `flowRulesOf` in the same folder holds the rest of the matrix and
its table test pins both positions. A flip never loosens a running Lead and never loses a pending
ask; a failed write keeps the old flow and shows the error on the row.

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
guidance: Auto picks the mount and asks when it is ambiguous. A conversation
with no folder attached still delegates a writer: the delivery says "MOUNTS:
none attached yet" with the way forward, never that nothing can start, and the
app attaches the project the task names or asks (see Mounts below). A role is named
with `@` in the field, which starts that role at once with no Auto turn first.

- The **Start a run** field (`StartRun`) starts Auto when its router picks one
  agent (rows 4 to 6 of `runRouteOf`, see
  [Start a run](features/start.md#start-a-run)): `spawnAgent` with the `auto`
  kind and the ask as its first message, or the role named with `@`. The field
  carries the same **Limit** chip (`useAutoTreeLimit`), which starts from the
  Limit of the Run defaults and applies to this run only. The route is kept per agent in `runs.routes.<sessionId>`.
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
  starts on the smaller of that cap and the Limit of the Run defaults of the workspace
  (`autoTreeLimitOf` in `packages/core/src/auto/`, which also names the winner;
  `startAutoRuntime`, `moveToAuto`, `useAutoTreeLimit` and `setSessionBudget`
  read the session cap this way), and
  setting a session budget that pauses under a running Auto's limit lowers that limit
  (`setSessionBudget` calls `lowerAutoLimitsToSession`, one write per tree
  that lowers only a cap still above the new limit on a tree not finished at
  write time; only the write checks the cap and the phase, never the earlier
  read, so a cap another window lowered first still ends at the smaller one
  and is never raised, and a cap raised after the read is lowered too), so the next turn pauses on what is
  already spent. A limit exists only when a person sets one. The workspace default is the Limit
  of the Run defaults page (see [Workflows](workflows.md)), and a start never
  stores a limit: an amount typed on the form is for that run only.
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
the right click and Search or run agree). It is blocked with "Wait for the turn to
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
transcript as an `operator_text` event, which carries the outbox row id; the
chat draws it once Auto has read the message (see **One queue**). The delivery text Auto builds for its
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
reaches Auto only when the child ends. That is the switch off.

**Answer while working.** With **Work** on (`flowRulesOf().isMessageDeliveredAtOnce`, read
by `deliverNext` from the `work.enabled` setting at every delivery), a `user` row is delivered
in `waiting` too, all pending user rows in one turn, while the agents keep running. The Lead
may answer, start another agent or say it waits. Its turn moves the tree to `deciding`; an
agent that settles meanwhile writes its results row as usual, and `settleAutoTurn` sends the
tree to `merging`, so those results go in the next turn, once. Delivery stays once per
outbox row id: a claimed or accepted row is never `pending` again, and a lapsed lease
reuses the stored delivery and its delivery id. Stop wins: a stopping tree delivers nothing.
The claim stores the turn number (`turns_used + 1`) in the stored delivery, and
`readAutoTreeViews` reads a note sent while agents worked back as `readMessages` with that
turn. The note words come from `noteWordOf`: "Queued" with the switch off, "Not read yet"
and "Read at turn n" with it on. Remove is the undo until the note is read; a note the
runtime could not deliver keeps "Not read yet" in the tree and stays editable.

**One queue.** The chat holds only what Auto has read. Every message not delivered yet sits above
the composer in one list, in send order (`QueuedMessages`, rows from `queuedRowsOf`): the `user`
outbox rows of the tree first (`pendingMessages` of the tree view, with their images), then the
messages of the agent queue (`store/slices/agentQueue`, used while the root's turn runs). A
message the drain moves from the agent queue to the outbox keeps its place: `routeAutoUserTurn`
reads the trees again before the tray lets go, and `queuedRowsOf` hides the `sending` tray row
whose outbox row is already in the view. A pending echo is not drawn in the chat: `rowsByDeliveryOf`
draws an `operator_text` echo that carries an `outboxId` only at the delivery event that lists that
id in `outboxIds`, right before it, so it never jumps above rows that happened before Auto read it,
and a pending or withdrawn echo is never drawn, after a restart too. A row dropped for another reason (`droppedMessageIds` of the tree view) keeps its echo where it was written, so its words stay in the chat. Events written before
the ids existed have no `outboxId` and stay where they were written.

A row reads one status word and nothing else: "Waits for this reply", "Waits for <task of the
child>" or "Waits for 2 agents" while the tree waits for running agents (`pendingMessageLineOf`,
`waitingForOf`), and "Not delivered" for a blocked or stopped tree, with the reason in its tooltip.
With **Work** on, every row that is not blocked or stopped reads "Not read yet" and offers no
Send now, because it goes at once (`useQueuedRows` passes `isAtOnce`).
**Send now** (`runtime.sendNow`, through `registerSendNowPort` and the window bridge) delivers that
one row at once as its own Auto turn, like a child's question, and leaves the children running. It
runs in the tree's queue and claims the row with the tree's phase revision and the row's
`claimed_by`, so a child that ends at the same moment cannot deliver it twice: whoever claims first
delivers it and the other finds no row. A waiting tree with no child in `starting` or `running`
(a lost turn end) is the watchdog's case: `deliverNext` delivers the pending `user` rows and logs
one `[auto] ... waited with no running agent` line.

**Edit and Remove.** Both work on an Auto row through one withdraw (`runtime.withdraw`, through
`registerWithdrawPort` and the window bridge, `withdrawMessage`). In the tree's queue it checks the
phase revision and the row, and ends the `pending` `user` row as `dropped` with the reason
`withdrawn` (`withdrawAutoOutboxStatement`, guarded on `claimed_by IS NULL`). A row the stop dropped
with the reason `stopped` can be withdrawn too. The row leaves, and for Edit the text and the images
return to the composer, only after the withdraw succeeded; the images are read before it, so a
failed read keeps the row. If the row was already claimed, nothing changes and the answer is
`delivered`: the message counts as delivered and arrives in the chat as any other, so words are
never lost. A refused withdraw (another window runs the tree) shows its message under the list and
keeps the row.

**A message the tree cannot take.** A `user` row is never sent to a tree that cannot run a turn,
and its row says "Not delivered". A tree blocked by the budget shows **Change limit** (raising it
delivers the row, as before). A tree blocked for any other reason but the time limit shows
**Retry**, which resumes the tree and delivers the row (the send itself already tries one Retry).
The time limit and a stopped or stopping tree have no action ("This conversation reached its time
limit.", "Auto was stopped." in the tooltip): the row stays unsent, and Edit or Remove still take it
back. Stopping drops the pending rows with the reason `stopped`; `readAutoTreeViews` keeps those user
rows in `pendingMessages` while the tree is stopping or stopped, so the row still shows. A
`finished` or `done` tree takes the message as a normal follow-up turn. Rows left from old trees
show the same row on load and are never auto-sent.

**Images.** A message to Auto may carry images. `routeAutoUserTurn` writes them once to the
session's scratch folder (`storeAutoImages`), so they have a full path, queues them on the `user`
outbox row (`images` in the payload), shows them as compact thumbs on the queued row and keeps them
on the echo (`operator_text` with
`attachments`). The delivery that reads the row hands them to Auto's turn (`storedAttachments` on
`sendTurn`, listed by full path in the prompt, never written again), and every child Auto starts
after that message gets them in its brief (`childImagesOf`: the images of the accepted user rows
of the tree's generation up to the delegation); the child page names them as chips. The launch
reads those images once, into the launch snapshot of the attempt (see The spawn record), and
starts the child with the stored list, so a relaunch after a crash hands over the same images
even when the tree got more since. An image that
cannot be written refuses the message with "Auto could not keep the images. Attach them again.":
nothing is dropped silently. A turn that is not an operator message or
a child is left to the plain turn. A message to the root of an Auto tree is never a
plain turn: with no Auto door registered at all (the runtime has not started yet)
`routeAutoUserTurn` refuses it with "Auto is still starting. Retry in a
moment." (one constant, `AUTO_STARTING_SENTENCE`, shared by every Auto action that finds no door) and the composer keeps its text.

## Overview

An Auto tree is one row, like any agent row: its state in the row word and the
cost of the whole tree. The word follows the tree phase:
**Deciding what to do**, **Starting agents**, **Waiting for Implementer and
Tester**, **Needs you**, **Reading the results**, **Failed**, **Stopping**,
**Stopped by you**, **Idle**, **Done**. The
children are not rows of the Overview; they live in the Auto tree of the Agents
panel.

Auto finishes itself only when the Lead may close the work: with the Work
switch on and the Close the work row at Lead (never set by a preset), a
`finish` block that was accepted settles the turn in the stored phase
`finished` instead of a resting phase (`settleAutoTurn`, `readIsLeadClosing`),
in the same guarded write. With the row at You, or the switch off, it rests.
A tree that rests after its agents settled (stored
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
  or one of its children in the center. The tree reads top down
  with Auto first and one row per child under it, ordered by when Auto
  started them, in the list of launches and in a focused launch
  alike (one `SpawnedAutoGroup`); a live tree opens, a settled one in the list
  folds to Auto with its count of children
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
  holds **Limit** "$5.00 from Harborline" (`autoLimitWordsOf`: the
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
  no role, Experimental or state chip; its menu holds **Rename** and
  **Mark finished** while Auto rests and its own turn is not running
  (`agent.markAutoFinished`). Steps open from a turn's summary line.
- **Delegation lines.** Each delegation is in the conversation
  (`AutoDelegationLines`). A settled one is one bare line: its role chip, the
  task Auto gave and **Open**. A child still in flight is one line too
  (`AutoChildCard`, no coloured side border): role chip, role, task, its state
  word in its meaning's colour (`AUTO_STATE_TONE`) and the active work time
  (`DelegationClock`, the same number as Working now and the Agents row, so a
  resumed child keeps its earlier work). The whole line opens the child and its
  right click menu holds **Stop**, which names the child; a failed stop leaves
  the line working with a notice. The facts come from `autoChildCardFactsOf`.
  The lines after one reply share one list (`mergedBatchesOf`). A revision is the same producer with "revising v2", then "v2
  ready". Its reason and result are in its pane. Lines read the
  delegation, attempt and agent rows, never the message text, so a reload draws
  the same lines. A child that waits for an OK carries the **Next step** card
  (see **Confirming**). The plan is not a row of the transcript: it lives in
  the **dock**, the top of the message box (`ConversationDock`, filled by `AutoDock` and `AutoDockPlan`),
  one line per state. A plan that waits reads "Plan v1 needs approval" with
  **Approve and start Build** as the only primary of the page, **Ask for changes** (it
  opens the Auto page and focuses the composer) and **Open plan**, both quiet.
  The label comes from `planApproveLabelOf`, the same function the run plan button
  reads. The button uses `useAutoPlanApproval`, the same as the plan view;
  approving sends the approval to the Auto root, so the run stays inside Auto.
  If the approval is saved but Auto was not told, the plan view keeps open with
  **Tell Auto**, and the dock that approved it reads "Plan v1 approved, Auto did
  not hear it" with the same **Tell Auto**: it sends "Approved plan v1." again.
  When two plans exist the dock shows the one that waits for your OK, else the
  newest (`dockPlanRowOf`). An approved plan is the
  artifact colour (`AUTO_STATE_TONE.artifact`), never green, and the line does
  not unmount: it settles to "Plan v1 approved" with **Open plan**. While the
  plan is revised it reads "Plan v1 · changes asked". A plan a writer took
  reads "Plan v1 used", and at the level **Never** it reads
  "Plan v1 · no approval needed" (`planAwaitsYou`): neither is an ask.
  Without a plan the dock folds to the live row (`DockLiveLine`): what runs,
  as in **Implementer running, Tester queued**, its clock and one quiet Stop
  that names its scope, **Stop Auto and 2 agents** (`autoDockStopOf`). Esc twice
  presses the same button. The live row sits outside the scroll of the dock, so
  a long ask never pushes Stop away, and **Esc again to stop** sits beside it:
  at the limit and on a failed tree too, Stop stays in the live row and the row
  of the limit keeps only the moves. Auto offers Stop whenever a delegation is
  open, a plan that waits for approval and a blocked tree included
  (`openDelegationCountOf`). A tree stopped while the root agent was idle reads
  **Stopped by you** in the dock (`AutoDockLive`). The dock shows one ask: an open permission or question hides the plan
  row, a next step that revises the plan hides **Approve**, and a project ask
  waits behind a plan. **Comments not sent** reads "2 comments on plan v1 not
  sent to the Planner" with a filled **Send to planner**; **Approve anyway** and
  **Discard my comments** sit in its menu (`AutoDockPlanComments`, the rule comes
  from `planPrimaryOf`); Discard asks first inside the menu and names a failure.
  Review changes stays out while a project ask, a next step or a plan waits
  (`isAutoTreeAtRestOf`). Once the tree rests, "Plan v1 approved" leaves the dock.
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
  pull request ("Auto needs you" only when its branch is unknown) whose
  sentence names the role, never the quoted ask: `The scout never started.` (or
  `failed.`, `timed out.`, one verb per child state from
  `autoStuckKindOf` and `autoStuckVerbOf`; a child that returned to Auto is
  not stuck and has no card), then the sentence its reason code maps to
  (`delegationReasonTextOf`), never a child's own words, which can be in
  another language, until the agent text plan gives
  each child a one-line summary in your language. Its verb reads **Retry**
  with the accessible name `Retry "<name>"`.
- **Why a child stopped, and what a done child said.** The second line of a
  stuck child on the rail and in the Running card is its reason in
  words, never a code like `declared_blocked`: a returned child's own summary
  from `delegation.result.declared.summary`, else the sentence the reason code
  maps to (`delegationReasonTextOf`, shared with the result card), else
  nothing (`delegationSentenceOf`). A done child shows the result it declared in `delegation.result`,
  then the summary Auto accepted, never the working `outputSummary`, and no
  "Auto asked:" line (`autoGroupOf`, `autoChildCopyOf`). While a child is stuck
  and Auto is live, Auto sits in the Needs you card as one block: the sentence,
  **Open Auto**, **Stop** and **Retry** on its right, and its agents fold under it
  (`AutoGroup.isStuck`), not Auto's own phase.
- **Stopped and replaced children are not stuck.** A delegation that settled
  `stopped` (you or Auto stopped it, or you declined its start, reason
  `declined`) is the child state `stopped`, which `autoStuckKindOf` does not
  count: it leaves Next and the Running card's stuck actions, reads **Stopped** on the
  rail, and shows among the latest finished items of the Done card and in
  the full log (`doneRowsOf`). A settled
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
  with its provider and **Open**, which opens the child page. Under that header the card
  reads in the reading order of [turns.md](./turns.md): one outcome line (the child's own
  `<<outcome>>` line, or the one `outcomeLineOf` computes: Done, Failed or Timed out; red checks or a failed push override the model line, the same as on the delegation card, because `deliveredResultsOf` computes the line once with `delegationResultOf` and the card only draws it), the
  artifact rows, then the notes. The state word is the outcome line, not a second label, and
  the card has no coloured side border. A child with no artifact keeps its report in
  `ClampedProse`, three lines then **Show more**; a failed, stopped or timed out child shows
  the outcome line and no body. When the child produced an artifact (`deliveredResultsOf`
  reads the `artifacts` of the result entry), the card leads with the same artifact rows as
  the delegation lines and the agent's own prose goes behind a closed **Earlier in this reply, N lines**
  (`ReadingNotes` fed by `summaryNotesOf`, which drops the outcome line and artifact blocks);
  a plan that waits for approval has no row on the card, its ask is on the line. The cards read data, never
  Auto's prose: an accepted `results` row of the outbox keeps the root run that
  read it (`accepted_run_id`), `readAutoTreeViews` reads those rows as
  `deliveredResults`, and the delivery row of the transcript (the `auto_delivery`
  item keeps the `runId` of its event) draws only the results of its own run. A
  result whose delivery row is not in the transcript is not drawn, never moved
  to the end, so a late result stays with the turn that read it; a reload and a
  second window read the same rows.
- **The glance line and the cards.** The Auto page header keeps the back row, the title
  and the menu, then one glance line, the same component for every run kind
  (`RunGlanceLine`: Auto, orchestrated, preset and a plain agent): a dot, the state word (**Needs
  you**, **Running**, **Queued**, **Ready**, **Paused**, **Failed**, **Stopping**,
  **Stopped**, **Done**, **Idle**, **Skipped**), one sentence, the spend of the limit and **Settings**
  (`autoGlanceOf` for Auto, `agentGlanceOf` and `runGlanceOf` for the others, all
  through `glanceOf`). **Settings** unfolds the unchanged chip row
  inline, never a popover; the row stays mounted so the asks and model slots
  keep their portals. Each cluster of agents is one soft card (`AutoTurnCard`,
  head `autoCardHeadOf`): the noun of the work it holds (**Plan**, **Build** or **Review**),
  the agent count and one word that follows the loudest child (**Needs you**, **Failed**,
  **Running**, then the settled word such as **Done**), then flat rows. A row is one
  target in one shape, settled or not (`AutoChildCard`): the whole row opens the child
  page, a finished row shows its outcome in one line under it, and the clock sits in a
  fixed right column.
  Your plan approval is a quiet line at the head of the card that follows it,
  **You · Approved plan v1**, never a right aligned bubble: an insertion that sets
  `claimsReply` receives the replies `claimedRepliesOf` gives it (the first card
  that settles after the reply, the open one last), and the approval text comes
  from `approvedPlanReply`. A message you write yourself stays a bubble.
  **What Auto was told** shows once, on the first delivery.
- **The state.** Auto's state is said once, in the dock (`AutoDock`,
  `AutoDockAttention`, phrases from `autoTreeLive`), never at the end of the chat:
  **Implementer running, Tester queued**, **Starting agents**, **Reading the results**, **Deciding what to do
  next**, a refused hand over in the user voice, **At the $5.00 limit. Nothing new
  starts.** with a filled **Raise to $10**, **Change limit** (opens the Limit chip's
  popover on the Auto page) and **Stop Auto**, plus a line on the agents still
  running when there are any, the block reason with a filled **Retry** and **View
  transcript** (a block at the budget offers **Raise limit**, **Change limit**
  and **Stop** instead, one at the time limit only **Open transcript**). The
  reason is never cut to one line: the phrase wraps to two lines and, when it is
  longer, the whole text opens in a tooltip on hover and on keyboard focus
  (`TailLine` with `TruncatedText` `lines={2}` and `isFocusable`). Only `deciding` reads
  **Deciding what to do next**: a resting tree (`answering`, `done`, `finished`)
  whose turn ended draws no tail and no Stop, the rail says Idle or Done and
  **Mark finished** is in the header menu. A Stop that fails says why in the dock and a Retry on the
  tail itself, in an inline danger notice under the line ("Couldn't stop the Auto
  agents", "Couldn't retry Auto"), never only in the notifications. While Auto's own turn runs, the
  thinking line of the conversation speaks instead. There is no separate strip
  of running children: the running rows of the cards, the rail and the dock
  already say it. The glance line under the title holds the state word, the
  spend and **Settings** only; the dock and the tail say the sentence, and both
  read one glance (`useConversationGlance`, `conversationAskOf`), so the word
  and the sentence never disagree. A permission a subagent asks reaches Auto's
  dock, named, oldest first, with `1 of 2` and **Open Implementer**. While a plan waits the dock owns the one
  filled button (**Approve and start Build**) and the next step card's **Continue** is
  secondary. Each card row shows the short task title,
  role glyph and elapsed active time (`DelegationClock`, shared with the rail).
  A delegation line's **Open** opens that child's page (`useAutoTreeActions`
  `openChild`). While a plan waits for approval the ask is the state. The composer says "Message Auto" while Auto
  waits, or "Message Auto, or describe changes to plan v1", and shows **Ask
  first** like any agent composer.
- **A child opens on its page, from every door** (`useAutoChildChat`, `AgentDetailPane`):
  a tree row, a delegation line, the Overview, a notification and Search or run land on one
  page with one box, and the back row reads **Back to Auto**. A saved window that held the
  old panel opens this page (`withoutRemovedPages`). The page title is the task
  Auto gave it (the first line of the brief when the task is missing); on top, the line
  "Auto started this agent and reads your messages to it.", why Auto chose that role, the model it runs on with its
  provider (no dollar amount: a child holds no money) and the note when the app changed
  the model (`AutoChildBrief`); then the child's conversation; at the end what
  came back (summary, files changed, checks with their source, open questions,
  `DelegationResult`: the outcome line first, where a red check or a failed push replaces the
  child's own sentence; then chips for files changed, the checks verdict, each failing check,
  **Retry checks**, the push state with **Retry push** and **Put back**, and each
  open question, four at most then **+N**; last a closed **Earlier in this reply, N lines** with the summary
  as markdown, open only when the outcome is red, any artifact block dropped by
  `splitArtifactText`) and its tail (`autoChildLive`: **Queued** only while Auto has
  accepted it and not started it, its live line with **Stop agent**, **Waiting for
  your OK** with **Confirm** and **Decline**, **Asked a question** (the question is in the
  conversation above), **Failed: <sentence>** or **Returned to Auto**). A failed child's
  end line has no recovery action: the conversation dock owns **Retry**
  through Auto, even without a closing result
  (`AutoChildEnd`, `ConversationDock/useAutoChildRecovery`, `continueStoppedAgent`). A stopped child has no tail line:
  the dock owns **Continue**. The end line sits under the attempt it belongs
  to, at the delegation's `settledAt`, not after the last turn of the page, so
  a plain turn written later reads below an older Failed (`useAutoChildChat`).
- **Talking to a child.** The child page carries one composer,
  "Message Implementer". A message to a child of a live tree is an attempt of its
  delegation, never a plain turn (`routeAutoChildTurn`, called by `sendTurn`, through the
  child turn port to the main window's `continueChild`). On a child that ended it starts a
  continue of the child's newest delegation at once: the same agent, its role, its worktree
  and its routed model, the words briefed as **New instructions**, outside Auto's turn
  (`autoContinueTreeStatement` holds the open, time and money caps). Its end settles to Auto
  like any attempt and shows in Auto's next delivery, so Auto may answer before the child
  does. On a working child the message waits in the agent queue (`agentQueue`, a DB row each
  window reads) and runs as that continue when the turn ends; a send that reaches a working
  child of a live tree is refused with "still working for Auto", never injected in the turn
  (`routeAutoChildTurn` passes `isBusy`, and `continueChild` answers it after the plain checks).
  Auto's continue passes the admission's artifact checks (`admissionChildRefusals`, fenced in its
  transaction by `inputArtifactStatementsOf`), and Auto's queued message waits as
  `awaiting_confirm` when the start row of its role is Ask or on a forced confirm
  (`admissionStateOf`). The person's own
  message goes on whatever the plan's state, and is refused only when an input artifact was
  discarded. The queue delivery id rides the port (`deliveryId`, kept in the continue's
  request), so a queued message sent again replays its delegation instead of running twice.
  Auto's own `message` takes the same queue, with an `auto-message:` id keyed on the delegation,
  Auto's run and the message's position in that run; a message whose text that run already
  saved replays instead of queueing again (`messageChild`). The chat keeps the person's words
  where they were written. A child that asked a question waits for Auto's answer, a child that
  rewrites an artifact goes through Auto, and files are refused: each with a sentence. A child
  of a finished, stopped or detached tree, or of an older generation, keeps the plain confined
  turn, files included: `routeAutoChildTurn` passes `hasFiles` and `continueChild` refuses
  files only after that plain answer. A queued Auto message never takes that plain turn: when
  `continueChild` answers plain, or the delegation it was sent for was stopped or timed out,
  `routeAutoChildTurn` drops it from the queue, so stale Auto text never runs as the person's.
  Any stop (yours or Auto's) drops the agent's queued Auto messages; the person's stay. The
  page composer names its agent: `ChatView`
  hands its `agentId` to `ChatInput`, which keys the draft, the queue, the
  attachments, the routing and the send by that id and remounts per agent, so a
  child's draft never shows in the main Auto composer, two children never share
  one, and a send or a Queue or Send now reaches the child (a stopped or done
  one takes the turn through the normal resume path). The store's selected
  agent of the session never decides the target. Every turn on a child runs
  with its delegation role and its route, whoever starts it (the person, the
  queue, a retry, a resume after a restart, Auto): `routeTurn` reads the newest
  stored delegation of the agent (`resolveChildTurn`, `getLatestAutoDelegationOfChild`)
  before each spawn, never the tree view of the window, and carries that role
  and route through the turn and its retries (`recoverTurnFailure`, which also
  keeps the caller's `onSettled`). An adopted agent counts while its adoption
  row stands and runs normally once a detach deleted it. What was read is
  claimed in one transaction before the agent is marked running
  (`claimTurnAdmission` in `startTurnRun`): the claim checks that the newest
  delegation of the agent is still the one read and sets the agent running
  on the turn's run id, so an adoption or a detach from another window either
  lands first and refuses the turn, or comes after and is refused itself as a
  running turn. A startup failure after the claim gives it back
  (`revertAgentStart` on that run id), so the agent is never left running
  without its turn. The same transaction writes an admission row
  (`turn_admissions`, m242) that lives until the spawn, so another window
  that loads the workspace or launches in between leaves the claimed agent
  running and an adoption or detach is still refused as a running turn
  ([turns.md](turns.md#turn-admission)). The turn
  runs only on the routed provider and model, and only on a provider in
  `AUTO_CHILD_PROVIDERS`: a model picked in the child's composer or a retry
  aimed elsewhere is refused, agent pins are ignored, a provider fallback that
  leaves the route is dropped so the failure reaches Auto, and a cooldown or
  budget move off the route is refused. Each refusal shows the person a plain
  sentence (`turnRefusalMessage`): Goodboy could not check whether the agent
  works for Auto, try again; the agent runs only on the model Auto chose, ask
  Auto to continue it; the agent joined or left Auto while the turn started,
  send it again. A refused or failed retry reaches Auto as a failed end that
  carries the sentence (`startDeliveredTurn` `failure`, the attempt reason in
  `finishAttempt`, a revise included), never as an empty success. A usage-limit
  continuation of a child saves the delegation and tree it belongs to with its
  stop; when it is refused it keeps the stop, so **Continue** stays, and Auto
  gets a note with the sentence without reading the delegation again
  (`continueAfterLimit`, `noticeAutoOfRefusedContinue`). A note Auto did not
  take shows in the child's transcript. A reading role (Scout, Planner,
  Investigator, Reviewer) cannot write: on Claude it keeps Read, Grep and Glob
  in plan mode with no shell; on Codex it runs in the read-only sandbox, which
  blocks writes but can still run read-only commands.
  The dock's **Continue** asks Auto to continue
  a stopped child, naming its delegation so Auto sends `retryOf` and the same
  agent goes on in its worktree; it never runs a plain turn on it
  (`docs/turns.md`, resume rules).
- **No permission picker in the tree.** The composer of Auto and of its
  children hides the session's permission mode picker: a tree member runs
  with its role's access, not the session mode.

## The agent tree model

`leadTreeOf` (`apps/desktop/src/features/auto/tree/leadTreeOf.ts`) is the one
model of the agents, notes and plans of a tree. It is a pure function over
loaded rows: agents are numbered by launch (1, 2, 2.1), a retry folds into the
agent it retries and keeps its number, a set of two or more settled siblings
folds to one line until opened, and notes and plans are unnumbered rows placed
by time among the top agents. Spend counts each agent once. The split per
branch lives only in `leadSpendByBranchOf`: an agent's spend goes to the row of
its own branch, the Lead's own turns to its primary branch, or to the group
without a branch (`mountId` null), and the rows sum to the total.

`LeadTree` (`features/auto/tree/LeadTree.tsx`) draws that model in two
densities. A row shows the glyph, the role name, the title, a clock while the
agent works and its own spend once settled; a compact row drops the title and
number. Arrow keys move a cursor, Enter selects an agent or toggles a fold, and
a fold never changes the selected agent id. A queued note is a node with the
word Queued, Edit and Remove (`noteNodesOf`, over `queuedRowsOf`); both call
the queue functions the composer tray uses, so a failure keeps the node. A
note that is sending has no actions and a removed one leaves no node.
`useLeadTree` loads the delegations, mounts and costs into `leadTreeOf`.
`LeadTree` shares the row tokens of `RunTree` but not its agent stream.

The Work tab of a branch reads the same model per branch (`branchLeadsOf`, through
`useBranchLeads`). Each Auto run of the branch group is one Lead line: glyph, the word
Auto, title, state word, and its spend on this branch (the split of
`leadSpendByBranchOf` for that mount). Below it the compact `LeadTree` lists only the
agents the Lead ran on this branch, flat under the Lead. A Lead that also worked on
another branch says `also on` with that branch, and that note opens its Work tab when
the Branch page knows the mount. The line has no button of its own: it opens the Lead
page, and the tree opens it too. A Lead is never listed on a branch it has no run on.

### The spawn record

`SpawnRecord` (`apps/desktop/src/features/auto/tree/SpawnRecord/index.tsx`) answers why
one agent exists, in eight fields: Why, Brief, Role, Model, Went in, Done when,
Result and Attempts. `spawnRecordOf` builds it from the stored delegation rows
through `delegationCardOf`, and nothing is computed outside that path. Why is the
stored `reason` (cut at 240 characters when written). Role is the role plus the
stored `roleReason`, with the role fit as "Why not X" when both are stored. Model
is the routing the delegation recorded and its `reason`. Done when is the stored
`doneWhen`. Attempts counts the `retryOf` chain behind the agent.

Went in reads the launch snapshot and lists it as given to the agent, never as
read by it. The snapshot is `auto_attempts.launch_snapshot`, written once by
`startAttempt` in the same transaction that inserts the attempt, so a snapshot
that cannot be written fails the start and never leaves a half-started attempt.
`launchSnapshotFor` (`store/runtime/auto/launchSnapshot/`) builds it right
before: the user notes up to the delegation (row id, with the turn the Lead read
it at), their images (the full references the child is started with), the
artifacts and versions the brief carried (`inputArtifacts` and the revise
target), the run guidance in the brief (`kickoffGuidanceOf`) and the routing.
Nothing rewrites it: a retry is a new delegation with its own first attempt and
its own snapshot, and a resumed attempt after a question writes none.
`readAutoTreeViews` loads the snapshots by delegation (`launchSnapshots`) and
`spawnRecordOf` reads the one of the agent's latest delegation through
`launchSnapshotOf`. An agent without a snapshot, for one started before the
column existed, reads "Not recorded": a state, not an error, and nothing is
recomputed from today's images. The record lives in the one right slot, is never stored,
and Esc or the close button closes it without a history entry. The record of an
agent is a pure function of that agent's rows, so a late result for another
agent does not repaint it. "Open transcript" opens the agent's own page; its
back row returns to the Lead.

### The Lead page

`LeadPage` (`features/session/components/LeadPage/index.tsx`) is the page of an
Auto root agent, at the address the Auto page always had
(`s/{session}/workflows/agent/{agent}`). `AgentOverlay` draws it for an agent
of kind `auto` and `AgentDetailPane` for every other agent; the chat, the
header and the action bar are `AgentDetailPane` and `AutoDock`, unchanged. The
layout follows the width of the pane (`leadLayoutOf`): from 1180 up the chat,
the tree (330) and the record when an agent is selected; from 860 to 1180 the
chat and the tree, with the record covering the tree and a back arrow; under
860 the chat alone, and the tree opens from an "Agents" count in the header.
The tree is `useLeadTree` over the composer's queued rows: `ChatInput` reports
them through `QueuedNotesReportContext` (`useReportQueuedNotes`), so a queued note is a
tree node whose Edit and Remove are the composer's own. A click on a line of
the chat or a row of the tree selects that agent. The selection is window
local, never stored and never an address (`useLeadSelectionStore`);
`openLeadAgent` is the door a compact tree on the board or the Work tab calls to
open the Lead page with an agent selected.

### Lead state words

With the Work switch on, a Lead reads one of five words: **Working**, **Waits
for you**, **Resting**, **Stopped**, **Finished**. `leadStopOf`
(`packages/core/src/auto/leadStopOf.ts`) is the one function that picks it,
from the stored phase, the Lead's own turn, a plan waiting for approval, a
project ask and the spend limit. Plan ready, an ask, the limit and a failed
turn are the reason next to **Waits for you**, never a sixth word; Stopping
reads **Stopped** with the reason `stopping`. `autoTreeWordOf` calls it for
every reader: the header word of the Lead page (`LeadHeaderWord`), the session row
(`sessionRunsOf`), the Lead line of a branch Work tab (`branchLeadsOf`, which
copies the row word) and the root of the tree (`railRowsOf`). With the switch
off the same function gives the Auto words of the Overview below, and the
header shows no word. `leadStopReaders.test.tsx` checks every word in every
reader.

### The workspace read

The Work list reads every Lead of a workspace across its open sessions, not one
session at a time. `listAutoWorkTreesOfWorkspace`
(`packages/db/src/queries/auto-work-trees.ts`) returns each tree with its
session goal, the project of its primary mount and its branches: the primary
mount and every mount its delegations of the current generation target,
each branch once. The `work` slice (`store/slices/work/`) loads each session
through `readAutoTreeViews`, so a Lead carries the same view the Lead page
reads. `loadWorkLeads({ workspaceId, filter })` keeps only the latest read; a
read for a workspace or filter the window left is dropped. A failed read keeps
the old rows and sets `isWorkStale`; the next poll retries. A change made in
another window shows on the next read.

`workRowsOf` (`features/work/workRowsOf.ts`) owns every number of the list. It
makes one row per Lead (a Lead on two branches is one row), takes the state word
from `autoTreeWordOf` and so from `leadStopOf`, the pending asks from
`leadAsksOf`, the agents running and the spend from the view, and the four
filter counts (All open, Needs you, Working, Finished). A filter's count is the
number of its rows. A Stopped Lead is in no filter.

## Plans

The plan a Planner writes opens in the right drawer. Its second row shows
**Needs approval**, **Approved** or **Revising to v2**, the version, **Ask for
changes** and **Approve and start Build**. Approval belongs to a revision: the button
is a compare and swap on the version the drawer shows, then Auto is told once
("Approved plan v1."). A newer version, a revise in progress, a used plan or a
discarded one refuse it with a sentence and the drawer stays open. A second
click, or a second window, on an approved version does not tell Auto again.
A writer role (Implementer, Tester, Docs, Scribe, CI fixer, Rewriter) taking a
plan needs its current revision approved while the Lead's Approve the plan row
reads Ask (`isAdmissionPlanGateOn`); **Never** and the global approval switch
both read Skip. The admission snapshot reads the rows for every handoff, and the
rows read the stored `agents.autoPlanApproval` setting through
`isAutoPlanApprovalRequired`; only the exact value `false` turns that switch
off. There is no screen for that setting yet. **Ask for changes** opens the
chat of Auto: a change written there makes Auto rework the same plan into
the next version.

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

A child that waits for an OK shows one **Next step** card under its line, never a
Confirm row (`AutoNextAction`, built by `nextActionOf`). The proposed child is the
primary tile ("Spawn implementer", or "Revise Retry-safe credit retries to v3"),
the alternatives of the proposal follow as tiles 2 and 3, and an optional hint
field sits under them. The button reads **Continue** whichever tile is picked
(**Retry** after a failure). The keys 1 to 3 pick a tile while focus is
inside the card; Enter in the hint field runs the pick. The card is the question
colour (`AUTO_STATE_TONE.waitingOnYou`) with an inner tone bar, not a side border.

- The primary confirms through `registerDelegationDecisionPort` with the typed hint
  (`confirmDelegation` appends it to the brief). No model turn runs.
- An alternative declines the primary first, then sends the Auto root one
  structured message: `Next step: <role>` on the first line, the hint after it.
  If the decline lost, no message is sent. If the message fails, the card stays as
  "Declined. Auto was not told." with **Tell Auto**, which sends only the message.
- **Decline** declines and tells nothing.
- A failed start keeps the pick and the hint, shows the reason in the card and
  reads **Retry** on the same delegation. A `lost` answer reads "No longer open".
- Without a port the card says Auto can't take the answer in this window yet.

The hint travels through the same port in every window (the multi-window bridge
carries it).

## Blocked and Retry

A tree is blocked when a guard stops the next delivery (three answers in a
row with no progress, the time limit, the budget, more than six returns in 30 minutes), when the provider refuses to
start Auto's turn, or when Auto stopped answering: a tree still deciding 10 minutes
after its delivery (`AUTO_STALE_DECIDE_MS`) with no live root run settles from what
the run left behind, or, with nothing stored, blocks with "Auto stopped answering
before it replied. Retry to send the message again." and puts the message back.

A tree blocked by a guard other than a limit reads **Failed** on every surface
(glance, row, card, tail), never **Blocked** or **Needs you**: it ended on an error
and **Retry** moves it. It raises `agent-error` for the session (`autoFailedRootsOf`),
the same reason a failed plain agent raises, and it does not count as a wait for you
(`autoWaitRootsOf` counts a plan, a project ask and a stuck child, compared on the
typed `AutoTreeState`, never on a display word).

A tree at its limit reads **Paused**, whether the budget is spent
or a guard blocked it for the budget or the wall clock (`isAutoPausedAtLimit`, the one
function the word, the glance and the row facts read). Its row sits under Needs you
with the word Paused, and it raises `run-paused-at-limit` (`autoLimitRootsOf`), not
`auto-needs-you`. It has no Retry card: the limit is raised, not retried.

A child that returned (outcome `blocked`, reasons `needs_shell`, `needs_writer`,
`needs_role`, `needs_decision` and `needs_user`, or `declared_blocked` and
`missing_tool` on rows from before the return) is not an error and not yours to
move. It reads **Idle**, with "Returned to Auto: <its request>" on its tail (the
one line it wrote, `returnedRequestOf`, else its summary), while Auto decides, and **Done**
only once Auto decided about it: continued it (`retryOf`), replaced it (`replaces`) or released it
with a reason (`isAutoDelegationReplaced`, which reads `isAutoReturnDecided` for a returned child). A
later agent on the same branch that names it in neither field is not a decision, and neither is a
proposal you declined: the turn that reads the decline repeats the return like any undecided one
(`declinedTargetsOfRow`). A returned row from before the structured return (no `returned` in its
result) keeps the older rule: any role that started later on its branch decides it, so it is
neither **Idle** forever nor delivered again (`isAutoReturnDecided`). A **Done** child has no tail line
on its page: `AutoChildEnd` draws only what `autoChildLive` returns. **Failed** is only for a real error (a process
error, a lost report, no closing), always with a sentence from
`delegationSentenceOf`, never a reason code. **Needs you** appears on Auto only,
when Auto asks you. The outcome stays `blocked` in SQLite; `autoSettledStateOf`
turns it into the word, and `autoChildWordOf` is the one function the tail, the
Agents panel, the delegation card and the Overview read. The dock draws no red
recovery for a returned child, replaced or not (`useAutoChildRecovery` reads
`autoSettledStateOf`), and the delegation card drops the **Blocked** outcome
line and the reason sentence from a returned child's result: it reads no line
while Auto decides and **Done** once Auto replaced it (`delegationCardOf`).

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
- the caps on returns, in the same table. Both count the whole lineage, from the root of the chain
  down every branch (`lineageOf`). A `retryOf` or `replaces` may name only a return no one decided
  yet (`targetRefusalOf`, refused with `retry_unavailable`): the latest agent of the
  task, never an earlier one already continued or replaced. Several children of one block may share
  a `replaces` to split the task, and count as one hand over; two `retryOf` of one agent in a block
  are refused as already retried. A propose block waits for you, so the two
  caps below do not refuse it; its child still names the return. `returnsPerDelegation` (2, the returns in the `retryOf` lineage, `returnCountOf`): the
  third return closes the child, a `retryOf` of it or of any agent in its lineage is refused with
  `return_limit` and the delivery tells Auto to hand the task to another role or ask the user.
  `rebriefsPerTask` (3, the agents replaced and Auto's continues with a `task` in the `retryOf`
  and `replaces` lineage, `rebriefCountOf`, counted with the other children of the same block):
  the fourth is refused with `task_rebrief_limit` and
  the delivery tells Auto to ask with a propose block. `messagesPerDelegation` (4 per child,
  `autoMessageCountOf`, Auto's messages only: the queued ones and the ones already run): the
  fifth is refused with `message_limit`, so Auto stops or continues it instead. The person is not
  capped. `returnsPerTreeWindow` (6 in `AUTO_RETURNS_WINDOW_MS`, 30 minutes): the seventh return row
  carries `isOverWindow`, `deliverNext` blocks the tree with that reason (`AUTO_BLOCK_TEXT.limit_returns`)
  and **Retry** clears the mark and delivers it;
- four open children and four per batch.

Deleting the root agent of a tree first runs the stop protocol on the tree (`stopAutoTreeForDelete`,
through the tree stop port and `stopTree`): the generation advances, every running child is
cancelled and the stop is confirmed only after that cleanup succeeded. If a child does not exit,
Auto is not running or another window owns the tree, the delete fails with the reason, the agent
stays and the tree stays unconfirmed; deleting again resumes the stop. The purge itself
(`agentPurgeStatements`) never touches the tree. The lists read only trees whose root agent is
still in the session (`liveAutoViewsOf`, through `useAutoTreeViews`): a tree
left open on an agent that was deleted or moved raises no **Needs you** card, no **Auto needs you**
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
retry of a completed child with no `task` starts the task again from the start; with a
`task` it keeps the work and follows the new instructions.

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

Auto runs read-only on every provider that can confine it. Claude's Auto lead uses
`--permission-mode default` at every session mode, with `--tools Read,Grep,Glob` and explicit
shell and write tool denies (`effective_permission_mode` in `providers/cli_args.rs`). Other Claude
read-only roles keep plan mode. Other providers keep their existing confinement, including
Codex `-s read-only` and Cursor `--mode plan`. Auto has no shell and never calls Goodboy from
inside its turn, so there is no bridge command, no capability token and no allow rule.
It decides by ending its final reply with at most one block:

```
<<auto>>{"action":"delegate","requestId":"r1","children":[...]}<</auto>>
```

- `delegate` hands one to four children to agents of a role (`requestId` is optional and
  derived from the run when missing; `children` is the spec `parseDelegateSpec` validates).
- `propose` offers one `primary` child like a delegate and at most two
  `alternatives`, each with a label and a role. The primary waits for confirmation;
  alternatives carry no brief and consume no budget.
- `answer` answers the question of a child (`delegation`, `question`, `text`, and an optional
  `artifact` id whose text Goodboy puts into the resume, see Substeps).
- `release` says a child that came back is no longer needed (`delegation`, `reason`). It is
  one of the decisions Auto owes every return; a child spec decides one too with `retryOf` or
  `replaces` (see The child returns, never blocks).
- A child spec with `retryOf` continues an agent that ended. With a `task` it continues with new
  instructions on top of the work so far: the same agent, its role and its worktree, the task
  briefed as **New instructions** (`prepareRetry`, `resolveDelegateChild`). A role, a title or a
  mount on a retry is still refused (`spec_invalid`).
- `message` tells a working child something (`delegation`, `text` of at most 2,000 characters,
  `AUTO_CHILD_MESSAGE_CHARS`). It is queued for the child and reaches it as its next turn when
  the current one ends, never in the middle of one (`messageChild`); a child that is not working
  is refused with `not_running`. Its queue id is the delegation and Auto's turn, so a recovered
  turn that applies the block again replays the saved or delivered message without queueing or
  counting it twice.
- `stop` stops a working child (`delegation`, `reason`) with the same cancel as the dock Stop
  (`stopChild`, the `cancelRun` port with `by: 'auto'`). The agent is marked stopped by `auto`,
  so the dock, the glance and the child row read **Stopped by Auto** (`stoppedPhraseOf`, the one
  owner of every "Stopped by" label). It settles `stopped` with the reason "Stopped by Auto:
  ..." and its work stays. The agent is marked stopped by `auto` as soon as the cancel answers,
  whatever it answers, and its queued `auto-message:` items are dropped (`cancelTurnConfirmed`,
  `dropAutoMessages`), so its parked queue never reopens it. The reason is saved on the
  delegation with `is_stopping` before the cancel, so a run end that wins the race, or comes
  late, settles with it (`settleAttempt`). A cancel that fails is refused with `tree_busy` and
  the delegation goes back as it was. A stopped revise frees its artifact in the same
  transaction (`failAttempt`, `stoppedRevise`). The deadline and idle cancel of `enforceDeadlines` stops with `by: 'auto'`
  too. A stop on a child that already ended changes nothing and answers `alreadyEnded`, never a
  refusal.
- `finish` says the work is done (`summary`). It is refused while an agent is open or a result
  waits, and the refusal says why. With Close the work at You it stores nothing: the tree still
  rests as Idle until the user marks it finished, and the prompt asks Auto to suggest **Mark
  finished** and to send `finish` only when the user asked to close. With Close the work at
  Lead and the Work switch on, the turn settles as `finished` and the prompt
  (`buildAutoSystemPrompt` with `isLeadClosing`) asks the Lead to end with `finish` once the
  work is done. A user message to a finished Lead opens it again.
- `mount` attaches a project of the workspace, on the branch the user named
  (`project`, optional `branch`, `reason`; `parseMountSpec`). It is how "create a worktree on
  app-web with branch X" is done: the worktree is the deliverable, so no implementer starts to
  run `git worktree add`. `applyMountBlock` follows the Add a project row through the
  `mountProject` port (`mountAutoProject`, which calls `ensureProjectMounted` with the branch as
  written): Allow (the **Never** preset) mounts at once, When the session allows it (**After the
  plan**) mounts only when the materialization gate allows it (the same allowance as
  `mountTaskFolders`) and otherwise asks, Ask (**Every step**) always asks. The result is a `refusal` row with a `mount` note (`state` `ask` or `done`), so replay,
  recovery and the one row per turn work as for a refused delegate. A project that is unknown
  or ambiguous falls back to the folder list. A done mount is written with the code `mounted`
  (`AUTO_MOUNTED_CODE`): it is never a refusal, so it adds no refusal to the count, no strike to
  the no-progress streak, no refusal line in the tail or the rail, and the delivery lists it under
  DONE BY GOODBOY. A project already added on another branch than the one named is not claimed
  as done: the row has the code `mount_elsewhere`, it says which branch the project is on and
  that the user decides about moving it, and the tail reads "Not added: that project is already
  added on another branch". `mountOnBranchOf` is the one owner of that check: it looks for the
  mount of the project on the named branch among every mount the session holds (a forked mount
  counts), and `mountAutoProject` runs it before the call and again after it, because
  `ensureProjectMounted` can adopt persisted mounts or share an in-flight request that ends on
  another branch. The project is looked up in the workspace of the owning session only, in the
  store and in the card (`knownMountOf`), so a same-named repository of another workspace is never
  picked. The card runs `mountOnBranchOf` after its Add as well and keeps itself with the conflict
  when another window added the project on a different branch.
- No block is a plain answer to the user.

The prompt takes an Asks you level, using the same three values as workflows
with its own default, **After the plan**. Each turn reads the
level saved for its session (`autoSystemPromptOf` through `readAutoLevel`; admission
reads the permission rows, whose presets are these levels), so a tree without its own
rows gets a prompt and gates from one setting, and a read that fails fails the turn
instead of guessing a level. **Every step** requires confirmation
for each child and a planner's plan before a change. **After the plan** lets
readers start freely, requires a planner's plan and user approval before a
writer, then continues without asking for each handoff. **Never** makes the
plan optional and tells Auto to choose and delegate without proposing a next
step. Force pushes still require confirmation and a backup at every level.
Auto must never end a turn with a prose yes or no question: a choice belongs
in a next step proposal for the app to show as a card.

At every level Auto never ends a turn saying it cannot because of mounts, tools
or permissions (`AUTO_NEVER_REFUSE_RULE` in `prompt.ts`): a request that needs a
role it lacks goes to that role. **Never** delegates at once, **After the plan**
follows its plan gate (a gate is a step forward, never a dead end) and **Every
step** sends a propose block so the user answers with a button. A writer that
cannot start for a real reason still ends in a card or a named next step.

`parseProposeSpec` validates the primary with the delegate rules and forces
confirmation. Alternatives live in the primary's request data, and the replay
hash includes them. Admission keeps the same plan, mount, owner and generation
guards as a delegate. A malformed proposal starts nothing and comes back as a
refusal. `proposals/propose.sqlite.test.ts` covers admission, recovery and replay.

`confirmDelegation` accepts an optional hint. It saves the trimmed hint and adds
it to the task and kickoff in the same transaction that accepts the child, so
confirmation needs no extra Auto turn and a retry of the work retains the hint.
A failed save leaves the old request pending. A competing decision, stop, changed
generation or lost owner returns `lost` without saving the hint. A decline stores a
full result with reason `declined`, because the delivery reads every result in the
batch. `storedResultOf` guards each reader: a stored entry that fails it reaches
Auto as one line and never stops the delivery or a new message. Decline ignores
hints. Confirm and decline both check pending state inside their transaction, so
a late decline cannot cancel a confirmed child. The proposal tests cover rollback,
retry and competing decisions.

Admission reads the Lead's permission rows from the database for every
handoff, after resolving the child ([Admission rows](#admission-rows)). With
no stored rows they are the session level: **Every step** stores each child
as waiting for its own Confirm or Cancel. At **Never**, an unapproved plan may
be consumed by a writer, while revision and artifact checks still apply.
Changing the level or a row never starts a child already waiting for
confirmation. An explicit child
`confirm: true` or an ambiguous revise still requires confirmation at any level.
A plan feeds one writer per role: a second writer of the same role on a plan
that an unsettled writer already took is refused `artifact_busy`, in the same
batch or a later one, while a tester or docs writer may still read it. A
writer whose plan version is no longer current is refused `stale_revision`,
whatever approval the older version had.

The storage helpers in `store/runtime/auto/level/` keep session overrides
and a separate default in the workspace value `auto.level`, whose key is
registered in `packages/db/src/queries/entity-value.ts`. A session override
falls back to that workspace default, then **After the plan**. Invalid
values fall through to the next default. Workflow autonomy is unchanged. A
write takes a named session or workspace target, compares and swaps, retries
one lost race and reports a failed write without updating window state. Picks made in one window
run in call order per workspace (`changeAutoLevel` queues them), so the last pick wins
and an older pick never retries over a newer one.
`readAdmissionSnapshot` reads the effective rows (`readAdmissionPermissions`);
`admit.ts` applies the same policy to the stored child state, receipt and
plan consumption. The level tests in `store/runtime/auto/level/` check
persistence, failures, second writers and pending confirmations.

Start a run shows the same chip (`AutoLevelChip`) for an Auto lead: it reads the
workspace default through `useAutoLevel` and `startRoutedRun` writes the pick
with `changeAutoLevel`.

The chip lives in the settings line of an Auto agent (`AutoLevelSetting`, next
to the Limit chip) and the workspace default in Settings, workspace defaults
(`AutoLevelDefaultRow`). Both go through `useAutoLevel` in `shared/hooks/`,
which reads `auto.level`, writes through the `changeAutoLevel` store action
(`writeAutoLevel` on a named session or workspace, then a reload of the value)
and keeps only the latest pick. A
failed write keeps the old level and shows the reason. The chip is rendered by
`AgentSettingsLine` itself, never through the composer slot, so the message
field is not affected.

`buildAutoSystemPrompt` reads `AutoLevel` and defaults to `DEFAULT_AUTO_LEVEL`
in `packages/core/src/auto/level.ts`; `buildTurnSpawn` still rebuilds it with
that default for every Auto turn. The level's planning instructions take
precedence over the role-addition guidance below. `prompt.level.test.ts` checks
each level's text and `store.auto-level-prompt.test.ts` checks what a turn sends.

### Permission rows

A Lead is an Auto tree: the screen says Lead, the code and the tables say
`auto`. Its autonomy is nine rows, a spend limit and four locked rows
(`packages/core/src/auto/permissions.ts`). The rows and their values are
`LEAD_PERMISSION_VALUES`: Approve the plan (ask, skip), Start agents that read
(ask, free), Start agents that write (ask, after the plan, free), Push a branch
(ask, when checks pass), Open or update a pull request, Add or upgrade
dependencies and Change protected files (ask, allow each), Add a project (ask,
when the session allows it, allow) and Close the work (you, Lead). The spend
limit is the tree's `cap_usd`, the same number the reservation guard reads. The
locked rows are not stored and not editable: force push asks with a backup,
merge is you, agents never push, the Lead never writes.

The three levels are the three presets in `LEAD_PERMISSION_PRESETS`, value for
value with what each level does today: Every step asks for the plan, every
child and every project; After the plan asks for the plan, lets readers start
and adds a project through the materialization allowance (`applyMountBlock`);
Never skips the plan and starts and adds freely. No preset holds a new ask:
push, pull request, dependencies and protected files are at their open value in
all three, and ask only once a row is set to Ask.

`leadPermissionsOf` is the one function that gives a row its effective value
and its source, in this order: the Lead's own rows (`auto_trees.permissions`,
m243), the workspace default (workspace value `auto.permissions`, read only
while the Work switch is on), the session's level, the workspace level, then
**After the plan**. The hidden `agents.autoPlanApproval` setting stands in for
the default's Approve the plan row while no Lead row and no default row holds
it, so a workspace that never opens the panel behaves as today; once a row
holds it, the row owns it, and a stored Ask is never overridden by the setting.
Start agents that write at After the plan with Approve the plan at Skip cannot
both hold: when either comes from a stored row it reads as Ask and carries a
`LeadPermissionNote` that says why; when the skip comes from the hidden setting and the writer
row from a level, it reads as free, which is what that pair does today. The
preset reads Custom as soon as the effective rows match none of the three.

`store/runtime/auto/level/readLeadPermissions.ts` reads a tree, a session or a
workspace target. `writeLeadPermission.ts` writes one row on the workspace
default (compare and swap on the workspace value) or on one Lead
(`setAutoTreePermissionsIfUnchanged`, compare and swap on the JSON it read); a
null value is Reset and removes the row. A lost swap re-reads and retries once,
then fails with "changed in another window"; a failed write keeps the old value.

The panel for these rows is `features/auto/permissions/`: `LeadPermissionsPanel`
shows the preset tabs (Custom lights by itself and is not pickable), the nine
rows on one grid, the spend limit read only, the four locked rows and the
closing sentence of `permissionSentenceOf`. A row saves when you change it;
there is no draft. An own row shows "This Lead" (or "Set here" on the default)
with **Reset**, which writes null; the other rows follow the default live. A
failed write keeps the old value and shows the error under its row, and the
panel reads again after every write. Picking a preset writes the level and
clears the own rows; on a Lead it pins a row only where a workspace default
would still disagree with the preset. `LeadPermissionsChip` mounts the panel
from `AutoLevelChip` (through `WorkAwareChip`) in Start work and on the Lead
page when Work is on; with Work off the level chip stays. Workspace settings
show it as the **Asks you** band (`AutonomyDefaultsBand`) in place of the **Auto asks you** row.
A row tightened while an agent runs applies to its next start. The tests are
`permissions.test.ts` (the compatibility table for each level with the switch
on and off, each precedence step, the stale pair) and
`leadPermissions.sqlite.test.ts` (writes, Reset, two windows, failure).

#### Admission rows

Admission reads four rows, never the level
(`store/runtime/auto/admission/readAdmissionPermissions.ts`, the Work switch
from `work.enabled`): Start agents that read decides whether a reader role
waits for your confirmation, Start agents that write the same for a writer
role (`admissionStateOf`; After the plan and Free start it, and an explicit
`confirm: true` still asks), Approve the plan turns the plan gate on for a
writer that takes a plan (`isAdmissionPlanGateOn`, in
`admissionChildRefusals` and in the transaction through
`inputArtifactStatementsOf`), and Add a project picks the mount mode in
`applyMountBlock`. With no stored rows every outcome equals the level.

A row changed between a proposal and your confirm never loosens it: a waiting
child stays waiting when its start row turns free, and `confirmDelegation`
reads Approve the plan again and, when it now asks, checks in its own
transaction that the writer's plan is approved at the revision it took
(`readPlanApprovalGuards`). If not, the confirm returns `refused`, the
proposal stays waiting and the action bar shows `CONFIRM_REFUSED_REASON`; the
plan was used when the child was proposed, so the way out is to decline it.
Two confirms start one child (the second reads `lost`). The tests are
`admission/admissionRows.sqlite.test.ts` (a table per row and value, the
default only with Work on), `level/admissionLevels.sqlite.test.ts`
(unchanged, no stored rows) and `level/confirmationLifecycle.sqlite.test.ts`.

### Asks

An ask is anything a Lead waits for you to answer, and every ask has one id.
`store/runtime/auto/asks/leadAsksOf.ts` lists the asks of one tree view: a start
that waits for your confirmation (`start:<delegation>`, a delegation in
`awaiting_confirm`, which keeps its one meaning, not started yet), a push that
waits (`push:<delegation>:<commit>`, a publish record in `awaiting_confirm`), and
one row of `auto_grants` per dependency, protected file or pull request ask
(`grant:<id>`). A stopped or finished Lead lists none. Counts are by ask id, and
the same need named twice by one attempt is one row (`insertAutoGrantStatement`
ignores the duplicate). The plan and a project ask keep their own flows and are
not in this list.

A grant row (`packages/db/src/queries/auto-grants.ts`) is bound to the attempt
that asked, or for a pull request to one version of its text, and its state is
asked, allowed, declined or used. It is current while its attempt is the latest
attempt of its delegation in the tree's generation, or while no newer text was
asked for the same subject. `answerAutoGrantStatement` moves only a current,
asked row, so a second answer and an answer for a superseded attempt or text are
dropped. An allowance is used up at launch: `startAttempt` reads
`listAutoGrantAllowances` and puts `markAutoGrantUsedStatement` in the
transaction that inserts the next attempt ([Launch guard](#launch-guard)), so a crash after Allow and before the
start relaunches with the allowance, and a second launch with the same allowance
aborts.

`answerAsk` (`store/runtime/auto/asks/answerAsk.ts`) is the one function that
answers an ask, by id, in the main window: a start goes to `confirmDelegation`, a
push to the publish act after it checked that the push still waits for that
commit, a grant to `answerGrant`, which guards the tree (not stopped, owner
lease), moves the row and bumps the phase revision, then drives the tree. It returns
allowed, declined or settled, and settled means the answer was dropped.
`createAskAnswerer` lets one answer per ask id run at a time: the same answer
again shares its result, a different one gets settled. Another window answers
through the `answerAsk` call of the Auto bridge (`features/auto/askAnswerPort.ts`);
the ask leaves both windows on their next read. `asks.sqlite.test.ts` and
`auto-grants.test.ts` cover a double answer, the other window, a superseded
attempt, an older commit, the crash before launch, counts by id and the old
start ask.

### Publish gates

The Push a branch and Open or update a pull request rows are enforced in
Goodboy's own publish step, never in the agent (an agent cannot push at all).
`readPublishPermissions` (`store/runtime/auto/level/`) reads both effective
values for the tree, with the Work switch from the `work.enabled` setting; a
read that fails reads as Ask for both, so a broken read holds and never
publishes.

- **Push.** `planPublish` takes the push value. `isPublishAskedOf`
  (`packages/core/src/auto/publish.ts`) is true for a force push at every value
  (it keeps its backup, as before) and for a plain push at Ask. A plain push at
  Ask is written `awaiting_confirm` instead of `pushing`, bound to its branch and
  the checked commit, so nothing reaches the host and the commits stay local. It
  lists as `push:<delegation>:<commit>` and reads "Waiting for you to confirm
  the push of <branch> at <sha>". Push runs the publish act `confirm` (one keyed
  queue per worktree, the `expectedState` guard, so two answers push once);
  Don't push writes `declined`, and `confirm` on a declined plain push is Push
  now. A retry of an allowed push pushes the recorded commit once; a retry of a
  push that was never confirmed plans again and asks again at Ask. A new attempt
  plans its own commit and asks again; an answer for an older commit is dropped.
  At When checks pass the path is today's, value for value.
- **Pull request.** The gate sits at publication, not at the Scribe's start.
  When a Scribe ends completed with text and the row says Ask, `finishAttempt`
  calls `holdScribePullRequest`: it inserts the `auto_grants` row
  (`grant-pr-<attempt>`, kind `pull_request`, subject the mount id, text version
  `pullRequestTextVersionOf`: the attempt plus a hash of the exact title and
  body) before the settle, and the settle writes the held text to
  `result_json.verified.pullRequest` (`ResultPullRequest`,
  `packages/core/src/auto/pullRequestAsk.ts`). Nothing reaches the host. The
  delegation completes with "The pull request waits for you to open it: <title>".
  `leadAsksOf` lists the grant only while a settled delegation of the current
  generation holds its text, so a grant left by a dropped settle never shows. `answerAsk`
  hands a pull request grant to `answerPullRequest`: Open moves the grant
  through `answerGrant`, claims the record (`awaiting_confirm`, `failed` or
  `declined` to `opening`, guarded on its state, a stale `opening` only after
  `PUSH_LIVE_WINDOW_MS`), calls the `publishScribePullRequest` port with the held
  title and body unchanged, then writes `opened` with the number and link and
  the grant `used` in one transaction, or `failed` with the reason and the text
  kept. Open again on a failed or declined record retries once per claim; a
  second Open while one runs is settled. Not yet writes `declined` and keeps the
  text. A newer text on the same mount (an update) asks again, and the answer
  for the older text is dropped because its grant is no longer current. At Allow
  the Scribe's text goes to the port as today. The port carries the extracted
  `output`, so the title and body the ask shows are the ones handed to the host
  call; the host path still adds its closing references and the hidden Scribe
  signature to the body, as on the Branch page.
- **A pull request honours the push row.** Opening a pull request pushes the
  branch (`createPrForSession`), so before any publication `openOrHoldPullRequest`
  runs `pullRequestPushGateOf`: at push Ask it reads the local head and the
  online head, and goes only when the head is online or a publish record of the
  tree already pushed that commit. Otherwise the pull request record moves to
  `awaiting_push` with a line ("The pull request opens after you push <branch>
  at <sha>") and the push ask for that commit is reused (a writer's record for
  the same branch and commit) or raised on the Scribe's own delegation as a
  plain push record (`heldForPushStatements`; `publishAct` accepts a plain push
  record on a Scribe). At pull request Allow this happens at the settle; at Ask
  it happens on Open. After every publish act, `releaseHeldPullRequests` runs the
  gate again for the held pull requests of each pushed or declined mount: Push
  opens them once (the claim guards it), Don't push keeps them held with "Not
  opened: you declined the push of <branch>, and the pull request needs it online
  first", and Push now opens them. A branch or head that cannot be read fails the
  publication with a reason, never opens it.
- `publishGates.sqlite.test.ts` covers the held push, Push, Don't push and Push
  now, a retry that pushes once, a newer commit, the workspace default, force at
  both values, the held text, Open twice, Not yet, a refused host and Open
  again, an update, Allow as today, the pull request behind the push row (push
  Ask with pull request Allow, push Ask with pull request Ask and Don't push then
  Push now, a reused writer push ask, a commit already online), and one case per
  host (GitHub, GitLab, Bitbucket). The scene data for `work-lead-push` is
  `features/auto/testing/workLeadPushView.ts`.

### Launch guard

The Add or upgrade dependencies and Change protected files rows are enforced
when a writer agent starts. The lists live once, in
`packages/core/src/auto/launchGuard.ts`: `PROTECTED_FILE_PATTERNS` (host CI
config, git hooks, code owners; env files are off the list because git ignores
them) and `PACKAGE_MANAGERS` (per manager: the add and upgrade commands, the
install commands, manifests, lockfiles and the offline settings).
`OFFLINE_PACKAGE_MANAGERS` names the managers with settings (npm, pnpm, pip, uv,
cargo, each checked by hand against the real tool: an add that would download
fails); yarn, bun and go are covered by the deny rules and the backstop only,
and the row's help line says so.

- **At the start.** `launchChildren.ts` reads both rows with
  `readLaunchPermissions` (`store/runtime/auto/level/`, a failed read asks both)
  for a writer and hands them to `startAttempt`. `launchGuardStart`
  (`store/runtime/auto/launchGuard/`) reads the allowances of the delegation the
  new one retries (`listAutoGrantAllowances`), builds the guard with
  `launchGuardOf` and stores it in `write_set_json.guard`; the
  `markAutoGrantUsedStatement` of every allowance sits in the same transaction
  as the attempt insert, so Allow twice starts one attempt and a crash after
  Allow relaunches with the allowance. With both rows at Allow there is no guard
  and the write set is exactly `{ worktreePath }`. A resumed attempt
  (`answerQuestion`) copies the guard of the paused one, and a relaunch reads
  the stored guard, never today's rows.
- **On the spawn.** `resolveChildTurn` reads the guard of the latest attempt of
  the child's delegation (an unreadable attempt refuses the turn), and
  `readTurnStream` sends `launchGuardRulesOf` as `launchGuard`: Claude deny
  rules for the add and upgrade commands, edits of manifests and lockfiles and
  edits of each protected pattern (appended to `--disallowedTools` in
  `cli_args.rs`), the offline settings in the environment
  (`providers/launch_guard.rs`, which refuses a guard on a CLI other than
  Claude or Codex and any reserved name), and for Codex no
  `sandbox_workspace_write.network_access=true`. Codex has no per-file rule:
  for protected files the backstop is the enforcement.
- **An allowance lifts one.** A dependency allowance lifts the dependency rules
  and settings for that attempt and keeps the protected ones; a protected file
  allowance lifts only the pattern that holds its path.
- **The brief.** `launchGuardBriefOf` (`kickoff.ts`) is added to the brief at
  launch: do not add or upgrade, installing what the lockfile holds is fine,
  and when a new one is needed end with `needs="dependency"` (or
  `needs="protected_file"`) and one line: the package, the version and why, or
  the path and why. An allowance adds "You may add nock@14.0.1".
- **The ask.** When the attempt returns with that need and its guard asks it,
  `needGrantsOf` adds the `auto_grants` row in the settle transaction
  (`settleAttempt` `grants`), subject from `needSubjectOf` (`nock@14.0.1`, or the
  path; a path off the list asks nothing). The Lead reads "the user is asked to
  allow it" and `waitingReturnsOf` leaves the agent out of its decisions while
  the grant is asked. After `answerGrant`, `restartAfterGrant` starts the agent
  again through `continueChild` (from the user): Allow with that one allowance,
  "Do it without" with the answer in the brief. Neither is undone, and a late
  answer for a superseded attempt is dropped. When the restart is refused (the
  tree is blocked or at its limit), the agent goes back to the Lead's decisions
  and the allowance waits for the next retry of that agent.
- `launchGuard.test.ts` (one case per package manager), `launchGuard.sqlite.test.ts`
  (Allow as today, the stored guard, a later row change, Allow once, Do it
  without, one protected path) and the Rust spawn tests in
  `turn/fake_cli_tests.rs` (rules, settings and network at Ask, byte-equal at
  Allow, an allowance that lifts one) cover it.

### Landing backstop

Deny rules match commands, so an agent that works around one can still change
a manifest. The backstop is the net behind the launch guard, not the
permission. `changeGateOf` (`packages/core/src/auto/changeGate.ts`) takes the
rules (`readChangeRules` in `store/runtime/auto/launchGuard/`: both rows read
now with `readLaunchPermissions`, a failed read asks both, plus the allowances
in the attempt's stored guard) and the changed paths. A manifest or lockfile of
any manager, in any folder, is refused while the dependencies row asks and the
attempt holds no dependency allowance; a protected file is refused while its
row asks and no allowed path names it. With both rows at Allow nothing is read
and the result goes on as before. A row tightened while the agent runs applies
to its result here.

- **At the end of an attempt.** `finishAttempt.ts` reads the changed files
  first (`attributeChanges` `changedPaths`, the whole list, not the capped
  `changedFiles`) and asks `landingRefusalOf`. A list that cannot be read in
  full (a snapshot or the committed diff missing) is refused: closed, not open.
  A refused result settles `failed` with the reason from `changeRefusalOf`,
  which names the files and says nothing ran and nothing landed.
  `verifyAttempt` is not called, so a changed script never
  runs, the publish plan holds, the Scribe opens no pull request, a revise does
  not reach `landAttemptRevision`, and the Lead reads the one refusal and may
  start the agent again. Nothing to undo: nothing landed.
- **At publish.** `planPublish` checks what the host would receive, not the
  attempt's own range, on every plan, at the settle and on a retry. The
  `readHostChanges` port (`launchGuard/readHostChanges.ts`) lists every path
  between the branch head on the host (`worktreeRemoteHead`) and the commit to
  push; when the branch is not on the host yet, or its head is not in the local
  repository, it diffs from the merge base with the mount's base branch
  (`worktreeDiffFromMergeBase`, a three dot `worktree_diff_range`, `origin/<base>`
  first). A gated
  path holds the publish with `so nothing was pushed`; a list that cannot be
  read holds it with the error and offers a retry.
- A refused change stays in the worktree and a later attempt may work on top
  of it. Its own diff no longer shows the change, so it can land, but the
  publish still sees it on the way to the host and holds until an allowance
  covers it.
- `changeGate.test.ts`, `launchGuard/readHostChanges.test.ts`,
  `launchGuard/changeGate.sqlite.test.ts` (a lockfile around the deny rule, a
  protected file, an unread list, a covered change, Allow as today, a row
  tightened before a retry, an allowed package landed and pushed, a refused
  lockfile behind a clean retry, an unreadable host list) and the Rust
  `a_range_diff_from_the_merge_base_leaves_out_what_the_base_changed_since`
  cover it.

Guidance for one Auto run lives in the workspace value `run.guidance`, a map of
the root agent id to its text (`store/runtime/runGuidance/`, compare and swap
like the level). `spawnAgent` writes it before the first turn. `buildTurnSpawn`
passes the agent id to `autoSystemPromptOf`, so `buildAutoSystemPrompt` adds a
**GUIDANCE FOR THIS RUN** block to every turn, and `resolveDelegateChild` reads
the root's text into each child brief as a `**Guidance**` section before the
`**Task**`. A run without guidance builds the same prompt and briefs as before.

After the routing table the prompt renders **WHEN TO ADD A ROLE** from `packages/core/src/roleNeeds.ts`
(`roleNeedsSection`, driver `auto`): per role a trigger the root can see and a "do not add it when".
Auto picks the narrowest row whose trigger it sees in the goal or in a result: history words
(regroup, squash, reword, split or tidy commits) for a Rewriter, a red check named anywhere for a
CI fixer, a pull request title, body or opening for a Scribe, a behavior with no test or a
regression for a Tester, README, docs or changelog for Docs. The Implementer row comes last: it only
changes code and is the fallback, and it also takes a check that must run commands and changes
nothing while no reading role has git. A "do not" beats a reason, and a force push
always brings a reviewer. The rewriter, scribe, CI fixer and implementer rows exist for Auto only;
the investigator row tells Auto that a red check goes to a CI fixer (`autoDoNot`). The
delegation rules add "decide once before you fan out": when two or more writers would get the
same task on different branches, one writer or a planner decides first and each writer gets the
decision in its task. These are prompt rules: a test proves the prompt holds each row, not that
the model follows it. The Orchestrated prompt renders the same table filtered to its roles
([workflows.md](./workflows.md) → Step sequencing).

**Role fit.** One row is enforced. `resolveDelegateChild` reads the title and task of a new
Implementer child with `roleFitOf` (`packages/core/src/auto/roleFit.ts`), a linear word scan with
no backtracking pattern. History words, a red or failing check and a pull request to write or
open count anywhere in the task; tests and docs count only in the title or the first work item (up
to the first sentence end, semicolon, "then" or comma after three words), so a code task that
continues with "then add tests and update the docs" stays with the Implementer. A path under
`docs/` or a `README.md` or `CHANGELOG.md` counts as a docs word. A word after no, not, never or
don't in the same clause (up to six words back, cut at but, then or instead) does not count, except
"no regression test". When a
narrower role fits, the batch is refused with `role_narrower` and nothing is written: "This task
asks for tests: a tester fits. Send it to a tester ("role":"tester"), or keep the implementer with
"roleReason": one line on why the implementer fits better." A second send whose child carries
`roleReason` passes; the admission stores `roleFit` and `roleReason` in `request_json`, and the
child's page shows "Why not Tester: <reason>" under "Why Auto chose Implementer" (`roleKept` in
`delegationCardOf`, `AutoChildBrief`). A retry, a continue and a revise keep their role and are
never scanned; a retry and a continue copy `roleFit` and `roleReason` from the earlier request, so
the page keeps its "Why not" line. While Auto cannot start a Rewriter (`AUTO_CLOSED_ROLES` in `roles.ts`), history work
fits the Implementer, so it is not refused.

The system prompt (`packages/core/src/auto/prompt.ts`) carries the role list and a routing table,
**WHICH ROLE FOR WHICH WORK**, generated from `AUTO_ROLE_WHEN` (one line per Auto role, so a role
cannot join without one): diagnosing a failure goes to an Investigator, tests to a Tester, text
about code to Docs, code changes to an Implementer when no narrower role fits, the pull request to a
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
with the reason in the words of `createPrFailureText` (a sentence the person can act on, shown on the child's card with Retry, which `delegationReasonTextOf` lets through because it starts with a capital letter), and a retry of the same child opens it once. The base it sends is a branch name from `requestBaseBranchOf`, so a mount that stores `origin/main` still opens against `main`. It names the `mount` field of a
child and the MOUNTS line it is filled from. Auto keeps its read tools and answers questions
itself; when it reports what happens next it describes a hand over and names the role ("I asked
an implementer to reinstall the dependencies"), never an action of its own. The brief of every
writer child carries `AUTO_DEPENDENCIES_RULE`: install missing dependencies with the project's
package manager in its own mount, never link or copy `node_modules` from another checkout. When
the dependencies row asks, the [launch guard](#launch-guard) adds its own section after it.

Only a writer role has a shell; Scout, Planner, Investigator and Reviewer run with `Read,Grep,Glob`
(`READ_ONLY_ROLES` in `cli_args.rs`). `packages/core/src/auto/roleTools.ts` holds that fact for Auto:
each role line of the prompt says whether the role has a shell, and the prompt rule says a task that
runs a command goes only to a role that does. `resolveDelegateChild` enforces it: a read-only role
whose task or done-when line names a command (`git log`, `git ls-remote`, `pnpm test`, "run the
tests", a commit range such as `a1b2c3d4e..HEAD`, or an output only git gives: the files of each
commit, a trailer, whether the remote branch exists) is refused with
`role_lacks_shell`, the message lists the roles Auto can start that run commands
(`AUTO_COMMAND_ROLES`, never a closed role) and quotes the phrase that
matched (`commandMentionOf`), and nothing is written, so Auto chooses again in its next turn. A
command inside a prohibition does not count: no, never, not, don't, without, skip or avoid (and
`non`, `senza`, `mai`) within six words before it, in the same clause, make "No yarn install" or
"never run git push" pass for a planner. A clause ends at a full stop, `!`, `?`, `;`, `:`, a new
line, "but", "then" or "instead", and at a comma followed by "run" or "execute", so "Do not run git
log, run pnpm test" still counts `pnpm test`. The scan is a linear walk, no backtracking pattern.
There is no read-only shell role yet:
a read-only check goes to a writer role with "read only, change nothing" in the task. A child that
returns with `needs="shell"` gets the reason `needs_shell`, and one with `needs="writer"` gets
`needs_writer`; the result of either carries the line that tells Auto to hand the same task once to
a role that can run commands (or change files) instead of reporting the return as the answer. A
closing with no `needs` (an old CLI) that says it had no shell tool in English is read as
`needs_shell` too (`isMissingShellText`, only when the attribute is absent). The reroute is Auto's own next hand over,
checked by the same refusal, not a second child started by the harness.

**Branch facts for a scout.** A scout cannot run `git log` or `gh pr view`, and giving a read-only
role a shell would give the Auto root one too (they share the read-only tool policy). Instead a scout spec may carry
`"facts":["<mount id>"]`, up to `AUTO_FACTS_MOUNTS_MAX` (4). `resolveDelegateChild` calls
`gatherBranchFacts` before the kickoff is composed: per named mount the `readBranchFacts` port reads
the commits since the base branch, the pull or merge request of the branch, its open review threads
and its checks, on GitHub, GitLab and Bitbucket alike (`makeBranchFactsReaders` goes through
`pullRequestPortFor` and the review source threads, the same functions the Branch page uses).
Every reader resolves the request of the mount it is asked about, never the active mount of the
conversation: the host comes from `mountRequestHostOf` (the remote of that mount), the request is
the one stored for that `mountId` (`mountGithub`, or `mountRequests` for GitLab and Bitbucket), and the
GitHub threads come from the detail of that mount (`refreshSessionPrDetail` with its `mountId`,
checked against the request number). A mount with no request reads "none is open"; a mount whose
request or detail could not be read, or was never read, reads "Facts not available: reason", never
"none".
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

**The child returns, never blocks.** The kickoff's Return section (`returnContract` in
`core/auto/kickoff.ts`) has a child end done, or do what it can, write its report and end with
`<<step-done id=".." status="returned" needs="shell">>` and one line after it: what it needs.
`needs` is `shell`, `writer`, `role:<role>`, `decision` or `user`; a reading role is told to keep
its report in the reply, never in a plan file. `parseChildClosing` reads the return into
`ChildClosing.returned` (the needs, and the request: the first line after the closing, else the
last line before it). An old `status="blocked"` closing is a return with no needs; an unknown value
or role reads `user`. The first closing line of the agent wins, a done or a return alike. The outcome row stays
`blocked` (no migration), the reason is `needs_<kind>` (`needs_role` for any role, the role is in
the result and `renderDelegationResult` names it to Auto), with `needs_user` for no needs, and `result_json.returned` keeps the needs and the
request. An old `status="blocked"` closing with no needs (`ChildClosing.isLegacyBlock`) settles as
blocked before the report check, and the shell text may refine its reason to `needs_shell`; a
`status="returned"` closing with no needs still fails as a lost report. A revise child that returns
lands nothing: the artifact keeps its version and the delegation settles `blocked` with the needs
reason (`returnedRevise` in `finishAttempt.ts`), whether or not its reply holds a whole new
version, so a partial plan that returns with needs keeps its request. A return is not a question: the substep roles of a blocking question stay scout and
investigator, and a reply that returns drops its blocking question, so the attempt settles instead of pausing.

**Auto is woken at once and must decide.** A return never waits for its batch. `joinReady`
settles the returned delegation and writes its own `results` row, keyed `return:<generation>:<delegation>`
with `returnOf` in the payload, in one transaction with the owner and generation guard; the batch
row later leaves that child out. A pending results row moves a waiting tree to merging, so Auto gets
the return while its siblings run; returns that land during Auto's turn wait and reach it together
in the next delivery. A return for an old generation is dropped (`finishAttempt` and the join both
read only the current one). A return while the tree is stopped, paused or finished stays pending and
is delivered on resume; nothing reopens the tree. Stop moves the generation on, so in the same
transaction it copies every undecided return row of the old generation into the new one
(`stopTree`, the same copy as a repeat) before the old rows drop; the message that resumes the tree
brings it back under WAITING FOR YOUR DECISION.

Every delivery opens with **WAITING FOR YOUR DECISION** (`waitingReturnsOf` in
`store/runtime/auto/returns/`, rendered by `buildDeliveryText`): each return with no decision, its
request, its needs and its report. A return is decided once a later delegation names it with
`retryOf` (continue) or with `"replaces":"<delegation id>"` (another role, stored in
`request_json.replaces`), a propose block included as long as you do not decline it, or once Auto sent `{"action":"release","delegation":"..","reason":".."}`
(`releaseDelegation`, which stores `request_json.released` with the reason and the run, guarded by
owner, the current generation of the tree and an undecided `blocked` row of that generation or an
older one). A release replayed by the same run with the same reason, as recovery does after a crash
between the release and the turn settle, is applied again without a write, never refused. `isAutoReturnDecided` is the one check: the delivery,
the turn settle and the Done word (`isAutoDelegationReplaced`) read it. A turn that leaves a delivered
return undecided copies it again, one row per return (`undecided:<generation>:<row>:<delegation>`,
`isRepeat`, kept out of the results block), and counts as a turn without progress, so three such turns
block the tree with the no progress guard. A return saved before this rule sits inside its batch
row with no `returnOf`: `returnIdsOfRow` reads the `blocked` results of such a row as returns, and when
that batch was delivered by an earlier turn, `joinReady` writes the missing return row
(`hasUnheardReturn`), so Auto is woken to decide about it. A blocked child with no `returned` in
its result is never delivered again (`isLegacyBlock`): Auto already dropped that work.

**The way back is an excerpt.** `parseChildClosing` keeps the answer of a child whole up to
`STEP_OUTPUT_EXCERPT_CHARS` (4,000, the budget the Runs excerpt owns) and above it the same
head and tail cut Runs use (`excerptStepOutput` in `summarizer/step-output.ts`, no model call),
with the line "[middle dropped, the full text is in the step transcript]" between; the last line
survives. The return, its `needs`, its request and the blocking question are read from the whole
answer before the cut, so a dropped middle never hides them. The summary is never the only copy of
a returned child's work: its report artifact is captured as on a done. `DELEGATION_SUMMARY_CHARS` is the same number. A writer
(implementer, tester, docs, ci-fixer) may attach its long report as a `report` artifact: the kickoff
expected text says so, `finishedPlain` registers what the child wrote, and a writer that wrote none
is not failed (`artifactPersistence` is `not_applicable`).

A read-only role (scout, planner, investigator, reviewer) owes its artifact, and `finishedPlain` tells
three endings apart through `artifactPersistence`. A report the harness registered is `ok`. A turn with
no artifact block at all is `not_written`: the delegation fails `report_missing` when the child closed
with the closing line ("It ended without writing its report.") and `no_closing_envelope` when it did
not. A turn that holds a block the harness could not store is `failed`, reason
`artifact_persistence_failed`. A child that returns with `needs` owes its report the same way: a return with no
report fails `report_missing`, not as a return. An artifact block written beside a blocking question
is not captured (`captureArtifactsFromTurn` skips a turn with a question unless the same turn
returns), so a scout that Auto releases with
its answer ("no longer needed, stop") and that then writes no report ends `report_missing`. The closing
line matches the id of the child ignoring whitespace inside it, so an id a model wrapped across lines
still closes.

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
(`isAutoChildTurn`: the agent has a stored delegation, whoever started the turn, or the turn is a
delegation with a confined role other than `auto`, which is the root) with `isAutoChild`;
`turn_spawn` refuses an `isAutoChild` spawn with no child role or on a CLI other than Claude or
Codex (`ensure_auto_child`); `turn_spawn` records the pid of the process it starts (`spawn_turn` in
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
the rerun's alike. `unknown` and `timed_out` never read green. **Retry checks** on the card
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
  failure; the retry reads the branch online first. Both live in `settledPush/`, with
  `sweepStalePushing`, which `createPushSweep` runs from the first tick of `startAutoRuntime`
  without holding the tick: a confirmed `pushing` record left by a crash on a tree that never
  recovers (done, finished, stopped) goes through the same `pushSettledPublish` to the same
  retryable failure. A row that fails to settle is reported and the sweep goes on. A confirmed
  record carries `startedAt` (the claim writes it, and so does `pushRow`), and
  `pushSettledPublish` leaves it alone for `PUSH_LIVE_WINDOW_MS` (15 minutes), because another
  window may still be pushing it; the sweep runs once more after that window when it met such a
  record, and a record with no `startedAt` counts as old. It scans `auto_attempts` once per boot
  and once more only in that case.
- `force` first needs the online sha read when the attempt started (`baseline_json.remote`; unknown
  holds). It keeps a backup ref of that online sha, the commit the force push replaces
  (`history_backup_create`, kept stamp so the History prune never drops it), and a second one of
  the start head when it differs; a backup that cannot be kept (the online commit is not in this
  copy) holds with "Fetch the branch and try again". A branch that was not online at the start gets
  no backup and no **Put back**. It refuses work whose tree differs from the start
  (`readCommittedFiles` start to sha) unless `changesContent` is set. It then waits as
  `awaiting_confirm`: one **Force push** / **Don't push** row per delegate batch
  (`PublishRunRow` in `AutoDelegationLines`, rows from `publishRowsOf`), one `publish` bridge call
  carrying every id. The row stays for the life of the push: **Pushing** on the button while the
  call runs (`pushRow` saves the `pushing` record, `isConfirmed` true, on the delegation and the
  attempt before the push starts, so a reload or a second window shows it; that save only lands
  while the record is still in the state the act read (`expectedState` of
  `patchAutoDelegationPublishStatement` and `patchAutoAttemptPublishStatement`), so two windows
  cannot both start the push; any answer for a record already pushing is refused "This push is
  already under way." and is quiet). The result is saved after the push; if that write fails,
  `settleRow` writes it again once, then writes a retryable failure "The push ran but its result
  was not saved. Retry the push to check the branch online" so the card never stays on
  **Pushing**. Then one line per branch from `publishLineOf` (the same words and tone as the
  `DelegationResult` chip): pushed with **Put back**, "Not pushed" when declined, put back, or a
  danger notice with the reason and **Retry push**. A failed row raises no toast; a refused answer
  whose saved record no longer waits for that act (`isPublishOpenOf`) is quiet too, because the
  reloaded card already shows the state. That check reads the store after `loadAutoTrees`, so a
  newer reload still in flight can swallow or add one toast until it applies. A failed force row
  stays once the user has acted (`isConfirmed` or `tries > 0`), so a **Retry push** held again
  (backup failure, red checks) keeps its notice and its button. A first plan held before anyone was
  asked shows only the chip.
- `executePublish` reads the online sha first (already the checked sha: pushed, nothing sent), then
  pushes the recorded sha itself, never the branch name or HEAD: `pushWithLease` sends
  `<sha>:refs/heads/<branch>` (`sourceSha`, `lease_push_args` in `github.rs`) with the lease on the
  recorded online sha, so a commit made after the checks is not pushed. On a failure it cannot
  classify it reads the online sha back before it writes anything. A lost lease reads the shipped
  "Origin changed. Check again before force pushing." Any failure is retryable once
  (`PUBLISH_MAX_TRIES`). **Retry push** always plans from the attempt's own commit (the
  record's sha, never the head of now) and the exit and completion stored in its result. A force
  retry reads origin again, keeps a new backup of it and waits for a new **Force push** with
  the new lease; a plain retry pushes the recorded sha again.
- `publishAct` (`confirm`, `decline`, `retry`, `put_back`) runs in the main window through one
  keyed queue per worktree, writes with `patchAutoDelegationPublishStatement` and the attempt twin
  guarded by generation, and answers one row per branch, so two of four branches can succeed.
  **Put back** pushes the backed up online sha (`leaseSha`) with the lease on the pushed sha first;
  a lost lease, or a failure whose read back does not show the backup online, changes nothing online
  or here and keeps **Put back** on offer. Only after origin is back does it move the local
  branch with the History restore, and only when the head is still the pushed sha; otherwise the card
  reads "Put back" with "The local branch was left as it is: " and the reason.
- Auto reads the line in the digest ("Pushed ...", "Not pushed: ...", "Waiting for you to confirm
  ..."). It is not sent again when a later click changes it.

`parseAutoBlock` (`packages/core/src/auto/autoBlock.ts`) reads only the settled text of a turn that
ended ok: it takes the last complete block, strips code fences, escapes raw line breaks in strings
and falls back to the last `}` when the close marker is missing. `store/runtime/auto/applyAutoBlock.ts`
runs at the top of `settleAutoTurn` and only for the current run of a `deciding` tree that is not
stopping, so a duplicate settle, a late settle after a stop and a recovered turn that passes the
same text admit once (the admission guards and the request id replay do the rest). A delegate block
that ends a turn which is no longer the current run (a settle that closed it without the text) is
never dropped silently: unless the request id was already admitted, it becomes a `not_deciding`
refusal row. A stop or a restart stays silent.

The runtime keeps the run ids of the Auto turns it started itself (`createOwnTurns`, set in
`deliverNext`, cleared after `settleAutoTurn`). `recoverTree` leaves such a run alone, because the
ledger marks a run done a few seconds before the turn saves its answer and a recovery settle in that
gap would read an empty text. `expireStaleDecide` skips such a run too, however long it has been
deciding, so the ten-minute watchdog never blocks a turn that is still saving its answer. Only a run
from an earlier process is settled from the ledger.

What Auto cannot say comes back as a message, not as a reply inside the turn. A refused spec, a
budget or limit refusal and a block that does not parse become a `refusal` row in the outbox,
delivered with the next turn under REFUSED, NOT DONE; such a turn counts as no progress, so
`noProgressStreak` bounds retries. When the next delivery finds that streak at its limit and the
row it would deliver is a refusal, the tree blocks with the reason of that refusal
(`autoRefusedBlockText`: "Auto kept trying to hand work over and was refused: the role it chose
cannot run commands. Retry to let it choose again, or tell it what to change."), not with the
generic no progress line, and the tail shows it with **Retry**. Every refusal text of a child
names the field or phrase to drop or change ("facts" on a reviewer, "publish" on an investigator,
"forQuestion" on a role that cannot take it, the matched command), so Auto fixes the spec in one
try. A refusal row keeps the action, the code and the roles of the
refused children; while it is pending for the current generation, `readAutoTreeViews` reads it as
`pendingRefusal` and the tail says it in the user voice (`refusalNoticeOf`, reasons from
`AUTO_REFUSAL_USER_REASON`): "Auto tried to start an Implementer. Not started: more than one
folder fits and it did not say which. Auto is choosing again." A refusal about the project
(`mount_ambiguous`, `mount_missing`) is asked instead (`projectAskOf`, `AutoProjectAsk`). When
the refusal comes from a `mount` block, or from a writer delegate whose `mount` names a project
of the workspace that is not added yet (`refusalMountNote`), and the project is known, the ask is one inline step:
"To do this, add payments-api", one line ("A worktree on ak/feat-new-explore is created from
main."), the primary **Add payments-api** (the button reads "Adding payments-api" while it
runs, a failure keeps the card with the reason), then **Add project**, **Answer without a
project** and **Decline**. The screens say "add", never "mount" (the `jargon-copy` guard
bans it); the block, the port and the code keep `mount`. The click mounts on the named branch and
sends Auto "Added payments-api on ak/feat-new-explore. Go on with my request.", so nothing is
retyped. A mount done at once (Never, or After the plan inside the allowance) draws one line,
"Added payments-api on ak/feat-new-explore" (`mountedLineOf`), until Auto's next turn takes the row. Otherwise
"Where should the Implementer work?" lists the session's projects with their branch, **Add
project** opens a filter over the workspace's other projects ("Not in this session. A worktree
is created from main."), and the primary follows the choice (**Use this project** disabled, **Use
payments-api**, **Use both**, **Use 3 projects**) next to **Answer without a project**, one
action row under the list, with **Decline** as a quiet verb (the `projectAsk` kind of
the action registry, drawn by `ObjectActionVerb`). The composer reads "Pick a project, or write
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
mount as `id (project, branch)` from `buildMountsLine`; with none it says none is attached yet
and that a writer is still delegated, never that nothing can start) and carries the artifact text of each
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
and `turn_spawn` refuses `auto` and every reading role on an opencode binary (`ensure_confinement`).
Its children run on Claude and Codex, never on Cursor, Gemini or Copilot, which cannot confine a role
(`AUTO_CHILD_PROVIDERS`): `routeTurn` refuses a child turn whose final provider is outside the list,
and `turn_spawn` refuses it again (`ensure_auto_child`). The pool of a tree is the run
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

## The outcome line

Every message that ends an Auto turn or a child's work starts with one outcome
line: `<<outcome>>text<</outcome>>`, at most 100 characters (`OUTCOME_MAX_CHARS`).
The Auto prompt asks for it (`READING_ORDER_RULE`, after the level rules) and
every child kickoff asks for it in its expected output
(`OUTCOME_EXPECTED_NOTE`). `core/auto/outcome.ts` owns the reading:
`parseOutcomeLine` takes the last block, `stripOutcomeLine` removes the blocks
from the prose, and `outcomeLineOf` decides the line shown. The model's words
never override the facts: red checks give "Checks failed: n", a failed,
declined or put back push gives the "Not pushed" text of `publishTextOf`. A
missing line falls back to the outcome word ("Done", "Failed: reason"), and a
message with neither shows no line. The tone of the line is data
(`success`, `danger`, `warning`, `neutral`); the screens that draw it come with
the reading order work.

### Action bar asks

`AutoDock` draws the first push, pull request, dependency or protected file ask
of `leadAsksOf` (`chat/askBarOf.ts`) in `AutoDockAsk`, after the plan and the
next step: one state, one primary, one quiet answer. The labels are Push or
Force push / Don't push, Open the pull request / Not yet, and Allow the named
package or file / Do it without. More asks show as "+N more". The right end
names the permission row, its value and its source (read in `chat/hooks/useAskPermissionRow/index.ts`). An
answer goes through `answerAsk` by ask id (`chat/hooks/useAnswerAsk/index.ts`): a second answer to
the same ask is dropped, a failure or a `refused` answer (with
`CONFIRM_REFUSED_REASON`) keeps the ask and shows the reason in the bar, and an
ask answered anywhere else leaves the bar on the next read. `PublishRunRow`
draws a held plain push as well as a force push, with Push now after a
declined plain push. The scenes are `work-lead-push` and `work-lead-dependency`.
