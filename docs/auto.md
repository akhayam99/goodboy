# Auto

> **Read this when** you change or explain the Auto agent: its experiment
> switch, how a person starts it, what it shows in the Overview and its chat,
> how a plan is approved, and which providers it may use. **Not for** the
> tables and the scheduler behind it ([architecture.md](architecture.md), Auto
> tree registry), the verbs it calls ([query-bridge.md](query-bridge.md)) or
> what a role is ([concepts.md](concepts.md)).

Auto is an agent that answers questions itself and hands the work it cannot do
alone to agents of the right role, with a model it picks for each. It waits for
their results, reads them and goes on. It ships as an experiment: off by
default, labelled **Experimental**, and the roles you pick today stay as they
are while it is off.

## The experiment switch

- Settings, App, General has a band **Experiments**, below Search, with one row
  **Auto agent**, its **Experimental** chip and a switch. The row says once what
  it does and that it may not work well yet. With the switch off and Auto agents
  still working, a muted line under it counts them: "2 Auto agents are still
  running. They keep going." The switch governs entry only.
- The value is the setting `agents.autoExperiment`. It is on only for the exact
  string `true`; absent or anything else is off.
- `isAutoStartEnabled` (`features/auto/isAutoStartEnabled.ts`) is the one
  function that says whether Auto is on. `useIsAutoOn` reads it for every
  surface. It needs the release gate too: `AUTO_GATES.isDelegationEnabled`
  reaches the screens through `AutoReleaseContext`, and while it is false the
  band, the Auto start and every Auto control stay hidden, whatever is stored.
- The switch saves with a compare and swap (`writeAutoExperiment`): it reads the
  stored value, writes against it, rereads once on a lost swap, and when an
  answer is lost after the commit it rereads and accepts what is stored. The
  cache repaints from the stored value only, so a failed save snaps the switch
  back and shows "Couldn't save the Auto setting". Two quick clicks write once
  (`usePendingAction`).
- The value reloads from the database when the window gets focus and whenever a
  start surface opens, so a second window follows the first.

## Starting

With the experiment on, Auto is the only start in the **Agent** tab of the New
drawer, in the **Start agent** popover of the Agents lane and under **Ask an
agent** on the New session page. There is no role list, no project field and no
guidance: Auto picks the mount and asks when it is ambiguous. With it off, the
start is the one of before: role grid, Generalist as default, Routing.

- Every start reads the stored setting at the click (`useConfirmStartMode`). If
  the form on screen is not the stored mode, another window changed it: the form
  repaints for the stored mode, the text is kept (the Auto goal and the legacy
  instructions move between `autoGoal` and `agentPrompt`) and the person starts
  again. Nothing starts in a mode they did not see.
- The goal is the first message of the Auto agent. It is not a plain turn: the
  tree is created at the start and the goal is queued in its outbox, so Auto's
  first turn is a delivery like every later one. A start that loses the message
  says "Auto didn't start" and the chat keeps no half-started turn.
- The composer is one goal, files, one model chip and **Start Auto**. Auto runs
  on Claude: a route on another provider is replaced by the Claude default for
  Auto (`autoOwnRouting`), and **Start Auto** says why it is off when Claude is
  not connected.
- The **Spend cap** chip proposes 5 USD, or shows the budget of the session when
  there is one. The first start stores the cap for the workspace
  (`auto.treeLimitUsd.<workspace id>`, compare and swap), so the next start is
  not asked again; a person can change it from the chip.
- A Next card that starts a role gets **Talk it through with Auto** as the last
  entry of its more menu. It opens the Agent tab with the card as context and
  starts nothing.
- **Generalist** keeps its name, with no mark of being old, and existing
  Generalist agents are not changed. Auto never appears in the manual role list.

## Talking to Auto

A message typed in the composer of an Auto agent is not a plain turn either. The
store's `sendTurn` hands an operator message for the root of an Auto tree to the
runtime (`routeAutoUserTurn`), which creates the tree if it is missing and
queues the text as a `user` outbox row; Auto reads it with the next delivery.
Approving a plan is the same path ("Approved plan v1."). A message the runtime
cannot take, or one with files, is refused with "Auto didn't get your message"
and the composer keeps its text. A turn that is not an operator message, a
child, or an Auto agent in a window with no runtime (the main window owns it) is
left to the plain turn.

## Overview

An Auto tree is one row, like any agent row: its state in the row word and the
cost of the whole tree. The word follows the tree phase:
**Deciding what to do**, **Starting agents**, **Waiting for Implementer and
Tester**, **Needs your approval**, **Reading the results**, **Blocked, open the
chat**, **Stopping**, **Stopped by you**. The children are not rows of the
Overview; they live in the Work rail of the chat.

## The chat

- **Work rail.** The chat of an Auto agent, and of each of its children, has the
  Work rail on its left. Auto comes first, then one row per child, all expanded
  and with no group row. A row has the role, the name and state on the first
  line, the model and time on the second. One spine runs from ring edge to ring
  edge in the tone of the ring it reaches: green when done, blue when working,
  dashed when queued. The foot is the tree budget, **Spent**, **Reserved** and
  **Left** from `treeSpend`. The rail can fold to a strip of rings, and it is
  not drawn for an Auto that only answers.
- **Delegation cards.** Each delegation is a card in the transcript: role, model
  and effort, a live time, one state, Auto's reason, a note when the app changed
  the model it asked for, **Reserved up to** while it works, and when it
  settles its summary, files changed, checks with their source, artifacts and
  open questions, then **Returned to Auto** with the cost and **Open chat**. A
  failed, blocked, timed out or stopped child says why in one sentence. A
  revision is the same producer: **Planner, revising v2**, then **Planner, v2
  ready**. Cards read the delegation, attempt and agent rows, never the message
  text, so a reload draws the same cards.
- **Where a card sits.** A card goes before the first message sent after its
  batch settled, and an open batch goes at the end.
- **While Auto waits.** A line above the composer says **Waiting for Implementer
  and Tester** with **Change approach** and **Stop**, and the composer says
  "Queued: Auto sees it with the next results". A plan that waits for approval
  changes it to "Message Auto, or describe changes to plan v1".
- **A child opened from a card** reads as Started by Auto. It can be read and
  stopped there, has no composer, and **Open Auto** goes back.

## Plans

The plan a Planner writes opens in the right drawer. Its second row shows
**Needs approval**, **Approved** or **Revising to v2**, the version, **Ask for
changes** and **Approve plan**. Approval belongs to a revision: **Approve plan**
is a compare and swap on the version the drawer shows, then Auto is told once
("Approved plan v1."). A newer version, a revise in progress, a used plan or a
discarded one refuse it with a sentence and the drawer stays open. A second
click, or a second window, on an approved version does not tell Auto again.
Auto cannot start a writer role (Implementer, Tester, Docs) on a plan that is not
approved. The policy is `isAutoPlanApprovalRequired`: the runtime reads the
stored setting `agents.autoPlanApproval` on every tick, and approval is required
unless the stored value is exactly `false`. There is no screen for that setting
yet. **Ask for changes** opens the chat of Auto: a change written there makes Auto
rework the same plan into the next version.

## Confirming

A revise Auto is not sure about waits for an OK in its card: "Change plan
Retry-safe credit retries at v2?" with **Confirm** and **Cancel**. The answer
goes through one port, `registerDelegationDecisionPort`, which the runtime
registers; without a port the click says Auto cannot take the answer yet.

## Providers

Auto itself runs on Claude. Its children run on Claude and Codex, never on
Cursor or Gemini, which cannot confine a role. The pool of a tree is the run
pool when there is one, else the workspace pool (the providers the workspace
policy on the Models page does not turn off), else every allowed provider
(`autoChildPool`, `runProviderPool`).

## What the screens read

The screens read the registry through the `auto-view` slice
(`loadAutoTrees`), which polls every 2 seconds while a session has an Auto
agent or a tree that is not finished. Nothing pushes tree changes to a window
yet. The numbers on screen come from the budget function the prompt and the
admission use, so they agree.
