# The Lead page and its tree

> **Read this when** you change the model of a Lead's agents, the tree drawn in
> the Agents rail or a branch's Runs tab, the Lead page frame, the Lead state
> words, or the ⌘K Lead rows. **Not for** the chat and dock in the centre of
> the page ([chat.md](chat.md)) or how one child reads
> ([children.md](children.md)).

## The agent tree model

`leadTreeOf` (`apps/desktop/src/features/auto/tree/leadTreeOf.ts`) is the one
model of a tree's agents, notes and plans, a pure function over rows that
`useLeadTree` loads (delegations, mounts, costs).

- Agents are numbered by launch (1, 2, 2.1). A retry folds into the agent it
  retries and keeps its number: a `retryOf` chain is one row, the latest attempt.
- Two or more settled siblings fold to one line when the caller allows
  (`canFold`: the Runs tab does, the Lead page never does).
- Notes and plans are unnumbered rows placed by time among the top agents.
- Spend counts each agent once: a row carries that agent's own spend
  ([limits.md](limits.md#spend-on-screen)). Only `leadSpendByBranchOf` splits it:
  an agent's spend to its own branch, the Lead's turns to its primary branch or to
  the group with no branch (`mountId` null). The rows sum to the total.

## LeadTree

`LeadTree` (`features/session/components/LeadTree/index.tsx`) draws the model as
an indented list in two densities, sharing `RunTree`'s row tokens but not its
agent stream. The Lead is the header row, then a hairline, then each agent on one
28px line:

- an uncircled role glyph tinted by state (`leadTreeInkOf`: muted done, info
  working, warning Needs you, danger Failed, faint Stopped and Queued);
- the brief as title, cut at a word edge (`briefFitOf`, `useBriefFit`), whole on
  hover;
- the state word unless done, then the clock while working or the agent's own
  spend once settled, in tabular figures.

A child is indented under its parent with a faint 1px guide per level
(`LeadTreeGuides`). A failed or stopped row is faint except its state word. State
and word come from `delegationCardOf` (`delegationNodeOf`), like the chat.

- The role name is the glyph's tooltip and label, not drawn. The row label starts
  with its number (`2.1 Scout, the brief, Done`) for screen readers. A compact
  row has no brief, so it keeps the role name.
- The viewed agent has `aria-current`, `bg-selected` and a primary left mark
  (`LeadTreeSelectedMark`), distinct from hover and the running tint.
- Arrow keys move a cursor; Enter selects or toggles a fold. A fold never changes
  the selected agent.
- A queued note is a row with Queued, Edit and Remove (`noteNodesOf` over
  `queuedRowsOf`), calling the composer tray's queue functions, so a failure keeps
  the row. A sending note has no actions.

When the Agents column is folded, `LeadTreeFolded` fills the strip under its open
button (`foldedActions` of `StudioRailLayout`): one tinted button per agent, the
Lead first, indented by depth, the viewed one marked, a click going through the
same `onSelect`.

### A branch's Runs tab

`branchLeadsOf` (through `useBranchLeads`) reads the model per branch. Each Auto
run of the branch is one Lead line: glyph, the word Auto, title, state word and
its spend on this branch (from `leadSpendByBranchOf`). Below it the compact
`LeadTree` lists only the agents it ran on this branch, flat. A Lead that also
worked elsewhere says `also on` with that branch, which opens its Runs tab when
the mount is known. The line opens the Lead page. A Lead is never listed on a
branch it has no run on.

## The Lead page

`LeadPage` (`features/session/components/LeadPage/index.tsx`) frames an Auto run
at the address the Auto page always had (`s/{session}/workflows/agent/{agent}`),
for its root and every agent under it. `AgentOverlay` draws it whenever the shown
agent's root (`resolveRootAgent`) is of kind `auto`, keyed by the root, and
`AgentDetailPane` alone otherwise. The centre is the shown agent's
`AgentDetailPane`: the chat and `AutoDock` for the root, the transcript for any
other.

The Agents rail (`RunAgentsRail`) sits in the session frame's left slot
(`data-session-lead`, the Changes files slot) with its rules: opens at 340,
resizable to 560, remembered (`run-agents`), folds to "Show agents" under 1060.
Its header ("Agents 15") counts every agent. The first row is the run
(`LeadTreeRootRow`, title and word from `autoTreeWordOf`).

The selection is the address, so reload, Back and Forward restore it. A click or
Enter on a row, or on an agent line in the chat, opens that agent's page without
remounting the rail. `ChatInput` reports queued rows through
`QueuedNotesReportContext` (`useReportQueuedNotes`), so a queued note's Edit and
Remove are the composer's own.

## Lead state words

A Lead reads a word of the shared table (`NAMES`): **Running**, **Needs you**,
**Idle**, **Stopped**, **Done**, and **Needs approval** when its plan waits.

1. `leadStopOf` (`packages/core/src/auto/leadStopOf.ts`) picks only the stop and
   its reason, from the phase, the Lead's own turn, a waiting plan, a project ask
   and the limit. Core never imports `NAMES`.
2. `leadStopWordOf` (`features/session/leadStopWordOf.ts`) is the one desktop
   function that turns it into a word.
3. `autoTreeWordOf` calls both for every reader: `LeadHeaderWord`,
   `sessionRunsOf`, `branchLeadsOf`.

An ask, the limit and a failed turn are the reason beside **Needs you**; Stopping
reads **Stopped** with reason `stopping`. `leadStopReaders.test.tsx` checks every
word in every reader.

## The workspace read

The ⌘K Lead rows read every Lead of a workspace across its open sessions.

- `listAutoWorkTreesOfWorkspace` (`packages/db/src/queries/auto-work-trees.ts`)
  returns each tree with its session goal, its primary mount's project and its
  branches (the primary mount and every mount its current delegations target).
- The `work` slice (`store/slices/work/`) loads each session through
  `readAutoTreeViews`, the view the Lead page reads.
- `loadWorkLeads({ workspaceId })` keeps only the latest read and drops one for a
  workspace the window left. A failed read keeps the old rows until the next
  poll.

`workRowsOf` (`features/work/workRowsOf.ts`) owns every number: one row per Lead,
the word from `autoTreeWordOf`, the asks from `leadAsksOf`, agents running and
spend from the view. A Stopped Lead is not open.
