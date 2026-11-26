# The Lead chat

> **Read this when** you change the conversation page of a Lead: its header,
> the glance line, the dock with its plan line and live row, the cards of
> agents, the composer, or the Lead's row in the Overview. **Not for** how a
> child shows ([children.md](children.md)), the frame and the Agents rail
> ([lead-page.md](lead-page.md)) or the messages themselves
> ([messages.md](messages.md)).

## What the screens read

The screens read the registry through the `auto-view` slice (`loadAutoTrees`).
`useAutoTrees` polls while a session has a live Auto agent or an unfinished
tree, through one shared poll per session (`startSharedPoll` in
`features/auto/useAutoTrees/sharedPoll.ts`): every 2 seconds, every 10 while the
window is hidden. Nothing pushes tree changes to a window yet.

## The Overview row

A tree is one row: the state word and the cost of the whole tree. The word
follows the phase: **Deciding what to do**, **Starting agents**, **Waiting for
Implementer and Tester**, **Needs you**, **Reading the results**, **Failed**,
**Stopping**, **Stopped by you**, **Idle**, **Done**. Children live in the
Agents panel's tree, not the Overview.

### Finishing

Only with the Close the work row at Lead (never set by a preset) does an
accepted `finish` settle the turn in the stored phase `finished`, in the same
guarded write (`settleAutoTurn`, `readIsLeadClosing`). At You, the default, the
tree rests, and a tree resting after its agents settled (phase `done`) reads
**Idle**, never Done.

**Mark finished** (`agent.markAutoFinished`, undoable) moves a resting tree to
`finished` (m231) through `moveRestingAutoTree`: one write that needs a resting
phase, no stop, no running turn and no open delegation, else "The Lead is working
again. Mark it finished once it rests." A finished tree is left out of recovery;
a message reopens it to **Deciding**.

## The page

The page keeps the session head and crumbs, then the title and menu, then one
glance line.

- The title is the first line of the ask (`autoRootTitleOf`), carried by the tree
  view (`AutoTreeView.rootAsk`, `readFirstUserText`) so no transcript loads: the
  root's first `operator_text`, else its first `user_text` not marked
  `deliveredBy: 'auto'`, then the transcript brief, then `agentHeadingOf`. It has
  the provider mark and no role or state chip.
- The menu holds **Rename**, and **Mark finished** while Auto rests and its turn
  is not running. Steps open from a turn's summary line.
- The tree of what Auto spawned is on the Lead page
  ([lead-page.md](lead-page.md#the-lead-page)). Every state word comes from one
  map (`autoTreeWordOf` for Auto, `delegationCardOf` for a child).

### The glance line

`RunGlanceLine` is one component for every run kind (Auto, orchestrated, preset,
plain agent): a dot, the state word, one sentence, the spend of the limit and the
run settings as words, built by `autoGlanceOf`, `agentGlanceOf` or `runGlanceOf`
through `glanceOf`. It sets `SettingLookContext` to `fact`, so each setting is one
dotted word that opens its own menu ("Stops after the plan · Ask first · Limit
$10.00").

- The words are always mounted, so an open event
  (`goodboy:open-permission-picker`, `autoLimitOpenEvent`) opens its popover on
  its word. The composer's asks slot sits in the same line.
- The glance line holds the word, spend and settings only. The dock and the tail
  say the sentence, and both read one glance (`useConversationGlance`,
  `conversationAskOf`), so word and sentence never disagree.

### Cards

Each cluster of agents is one soft card (`AutoTurnCard`, head `autoCardHeadOf`):
the noun of its work (**Plan**, **Build**, **Review**), the agent count and the
word of the loudest child, then flat rows (`AutoChildCard`,
[children.md](children.md)).

- A batch sits before the first message sent after it settled; an open batch at
  the end.
- Your plan approval is a quiet line at the head of the next card, **You ·
  Approved plan v1**, never a bubble: an insertion with `claimsReply` takes the
  replies `claimedRepliesOf` gives it, text from `approvedPlanReply`. A message
  you write stays a bubble.
- **What the Lead was told** shows once, on the first delivery.

## The dock

The plan and Auto's state live in the **dock**, the top of the message box
(`ConversationDock`, filled by `AutoDock` and `AutoDockPlan`), never in the
transcript. It shows one ask: an open permission or question hides the plan row,
a next step that revises the plan hides **Approve**, a project ask waits behind a
plan. A subagent's permission ask reaches the dock, oldest first, with `1 of 2`
and **Open Implementer**. Push, pull request and grant asks are in
[permissions.md](permissions.md#action-bar-asks).

### The plan line

`dockPlanOf` decides the line; the glance, the placeholder and the retry targets
read it too.

| State     | Line                                                                                                                                                              |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Waits     | "Plan v1 needs approval": **Approve and start Build** (the page's one primary), **Ask for changes** (opens the Auto page and focuses the composer), **Open plan** |
| Updating  | "Updating plan v1 to v2" with the planner's state; Approve and Ask for changes disabled                                                                           |
| Failed    | "Plan v2 failed" with the reason, **Retry plan v2**, **Keep plan v1**                                                                                             |
| Approved  | "Plan v1 approved" with **Open plan**, artifact colour (`AUTO_STATE_TONE.artifact`), never green                                                                  |
| Used      | "Plan v1 used"                                                                                                                                                    |
| **Never** | "Plan v1 · no approval needed" (`planAwaitsYou`)                                                                                                                  |

- The label is `planApproveLabelOf`, shared with the run plan button. The button
  uses `useAutoPlanApproval`, like the plan view, and tells the Auto root.
- Approval saved but Auto not told: the plan view and the dock offer **Resend
  approval**, which sends "Approved plan v1." again.
- A discarded or superseded plan never asks; used and no approval are not asks.
- A planner delegated after a waiting plan replaces it (`planLineOf`): disabled
  buttons say why (`planBlockedReasonOf`), and Approve is left out when the Next
  step asks for that revision. v1 reads Superseded. An open revise and a change
  sent for v1 read the same way. A planner still at `awaiting_confirm` does not
  replace it.
- **Keep plan v1** stores `request.keptBase` (`keepAutoPlanBase`, refused once v1
  is not current); only then does v1 ask again. A late failure or change for an
  older version says nothing.
- The approved line does not unmount; it leaves once the tree rests. An artifact
  that needs no approval shows only on its result card.

**Comments not sent** reads "2 comments on plan v1 not sent to the Planner" with
a filled **Send to planner**; **Approve anyway** and **Discard your comments**
are in its menu (`AutoDockPlanComments`, rule from `planPrimaryOf`); Discard
asks first inside the menu and names a failure. Review
changes stays out while a project ask, a next step or a plan waits
(`isAutoTreeAtRestOf`). While a plan waits the dock owns the one filled button
and the next step's **Continue** is secondary.

### The live row

Without a plan the dock folds to the live row (`DockLiveLine`): what runs
(**Implementer running, Tester queued**), its clock and one quiet **Stop run**
for the Lead and its agents (`autoDockStopOf`). Esc twice presses it.

- It sits outside the dock's scroll, so a long ask never pushes Stop away, with
  **Esc again to stop** beside it. At the limit and on a failed tree Stop stays
  here and the limit row keeps only the moves.
- Stop shows whenever a delegation is open, a plan that waits for approval and a
  blocked tree included (`openDelegationCountOf`). A tree stopped while the root
  was idle reads **Stopped by you** (`AutoDockLive`).

### The state

Auto's state is said once, in the dock (`AutoDock`, `AutoDockAttention`, phrases
from `autoTreeLive`), never at the end of the chat. It covers what runs,
**Starting agents**, **Reading the results**, **Deciding what to do next**, a
refused hand over in the user voice, the limit line with **Raise to $10**,
**Change limit** and **Stop run** ([limits.md](limits.md#at-the-limit)) plus a
line on the agents still running when there are any, and a block reason with
**Retry** and **View transcript**.

- The reason wraps to two lines and opens whole in a tooltip on hover and focus
  (`TailLine`, `TruncatedText` `lines={2}`, `isFocusable`).
- Only `deciding` reads **Deciding what to do next**. A resting tree
  (`answering`, `done`, `finished`) draws no tail and no Stop.
- A failed Stop or Retry says why inline under the line, never only in the
  notifications.
- While Auto's turn runs, the thread's thinking line speaks instead. No separate
  strip lists running children.

## The composer

"Message Lead" at rest and while the Lead waits, or "Message Lead, or describe
changes to plan v1", with **Ask first** like any agent composer. The composer of
Auto and its children hides the session's permission mode picker: a tree member
runs with its role's access. The settings line (`AgentSettingsLine`) holds the
level and Limit chips ([permissions.md](permissions.md#the-level-chip),
[limits.md](limits.md)).
