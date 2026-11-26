# Drawer kinds

> **Read this when** you change what one drawer kind shows: an artifact, Ask, a transcript, Context and its decisions, a comment, a script run, a file diff. **Not for** the frame, tiers and slots, or adding a kind ([right-drawer.md](right-drawer.md#kinds-and-the-host)).

## An artifact opens by one rule

`openArtifactAnywhere` (`features/plans/`) serves every entrance:

- **An artifact of the session you are on** opens in the `artifact-document` drawer
  beside the page (a plan from the planner that wrote it, a plan, report or
  wireframe row in Activity, a transcript chip, the object menu's **Open**, the
  palette on a session page). The address and the page's scroll do not change.
- **From any other page** (a Search hit from the Board, Tasks or another session) it
  goes to that artifact on the Artifacts tab, selected. On the Artifacts tab a click
  selects it.

`DrawerHost` hands a report or a wireframe to `ArtifactReadingDrawer`, with **Open
full page** as its one header action. Opening another artifact replaces it and
leaves the back chip; a deleted one opens the gone state (`GoneObject`) with Close.

A pull request opens its **Conversation** tab from every entrance; only a search
hit on a comment opens **Comments**. Labels name the place: **Open in Context**,
**Open in Questions**, **Open in Runs**, **Open pull request**. When Search opens an
artifact in the panel, find in view (`startViewFind`, `scope: 'panel'`) reads the
panel body only (`FindSession` inside `[data-drawer-card] [data-find-root]`).

### The artifact document

**Open full page** (`DrawerFrame` `page`, tooltip Open in Artifacts) is the one name
for panel to page (`retired/open.ts` keeps the retired ones).

- `artifact-document` carries `{ artifactId, revision }`: `revision` is `null` for
  the current version, a number for an earlier one.
- The one reader-tier drawer: it opens at 720px and drags from 480 to 1000 (a double
  click resets to 720), so there is no Expand; the body stays on the 720 measure.
- The header holds the title, **Copy markdown** and **Open full page** as 28px icon
  buttons, and Close; the second row the state chip, `vN`, the parts, **Edit** and
  **Run plan**. **Copy markdown** is absent when the plan has no copy action.
- Escape closes it. While the planner revises the plan the body is dimmed and Run
  plan waits.

The `artifact` kind (`{ artifactId, tab }`, `tab` `details` or `chat`) opens from
the artifact shell's one `Details` button on the tab last used, switching in the
header. It closes when the focused artifact changes, and Escape closes it before
taking the artifact back to the list.

## Ask

A dock tool of the session (kind `ask`, payload `null`, a row tool with a 260px row
minimum), drawn by `AskPane`; `openAsk` and `closeAsk` open and close its grid
entry, `selectIsAskOpen` reads it ([session-tools.md](session-tools.md#opening-the-tools)).

- The thread on screen lives in the `ask` slice (`askThreadId` per session, `null`
  for a fresh one). `AskPaneBody` (`features/session/ask/components/AskPane/`) puts
  it in the frame's `ScrollFade` and the composer in its `dock`.
- The question bubble (`UserMessageBubble`) and **Start work from this**
  (`StartWorkFromChatButton`) are Chat's, from `shared/components`; the composer is
  the `MessageComposer` that `ChatComposer` wraps, without images, its model picker
  in the `model` slot.
- Start work on a finished answer adds a brief drafted from the thread to this
  session and opens Start a run there (`startWorkFromAsk`). The questions stay in the
  session's `ask` threads, never in the Chat door.
- The header is **Ask** and a **New question** icon button (⌘N inside the panel,
  also in ⌘K), with no session title or scope chip.
- The thread follows a reply only while you sit at the bottom (`useAskFollow`).
- Reset starts a clean thread (`newAskThread`, `askThreadId` back to `null`) and the
  old one stays under **Earlier**, so no Undo is needed. It waits while a reply
  streams.
- **The draft survives**: `askDrafts` holds the composer text per thread
  (`threadId`, or `${sessionId}:new`), in memory. Closing with Esc, the X or `⌘L`
  keeps it; a send that lands clears it and a failed send puts it back.

### The body

1. **Right now** (no model call: `askRightNow` over `askDigestOf`, the five comment
   words, running agents, open questions, the session cost) and three suggested
   questions, under `Ask this session`; each mark is one text line tall, so it
   centres on a wrapping line. Once a thread has turns it folds to one row.
2. **Earlier** threads, on a fresh thread.
3. The turns.

An answer chip that targets a page navigates (the drawer stays), except a question
chip, which opens the question on its address (`openQuestion`) under **Back to Ask**
(`question` drawer, `from: 'ask'`), and a plan or artifact chip, which opens inside
the drawer under **Back to answer** (Escape goes back first). Buttons come only from
verbs the registry offers now (`askVerb`, `useAskActions`): **Answer: {the
question}** prefills and focuses the field, **Review N ready** runs
`session.review`, **Tell {agent}…** prefills the agent's box and runs
`agent.message`. A confirmed verb shows an `InlineConfirm` first; nothing runs in
one click.

## Transcript

`transcript` (`{ agentId }`) shows one agent's conversation beside the page at the
saved width (sizing `default`, like Ask), without selecting the agent: the page keeps
its address and trail (`loadAgentTranscript` with `isSelecting: false`). Top to
bottom: a lead (the fix run summary for a resolver), the transcript, and a field
that sends to that agent (`sendTurn`, draft in `agentDraft`). A resolver's
transcript always opens here, on its Branch's Comments tab
([branch-comments.md](branch-comments.md#the-resolver-stays-on-its-comment)).

## Context

`context` carries `{ section, view }`: `section` (`goal`, `decisions`, `summary`,
`explanations`) is the card it scrolls to; `view` is `current` or `versions` (the
slot's old versions, with Restore; Escape and the **Back to** link leave the view
before the drawer).

- The **Context** tool toggles it on any session page; ⌘⌥C opens the Context tab
  instead, and a restored Context panel opens as that tab.
- It opens on Goal unless the caller names a section (an Activity decision change
  opens Decisions).
- The old addresses `s/{session}/context`, `context/goal`, `context/decisions`,
  `context/summary`, and a saved drawer with `tab` instead of `section` (`learned`
  reads `explanations`), map through `withoutRemovedPages` to the overview with this
  drawer open; the lens kinds `context`, `goal`, `decisions` and
  `last_output_summary` no longer exist.
- The header's one action, **Copy context**, copies Goal, Decisions, Summary and
  Open questions in that order (`shareableContext`).

### What is new since you read

The chip carries a quiet dot, never a count, while the decisions ledger holds a
change you have not read (`sessions.context_seen_at` against the ledger rows in
`decisionChangesSince`: added, removed and reworded rows, leaving out your own and
what came and went unseen).

- Opening or closing marks nothing; only **Mark as read** does (`markContextRead`).
- A session never looked at sets its baseline on first load, so old rows never read
  as new.
- The last read is refetched when the drawer opens and on window focus
  (`loadSessionContextSeen`, from `useViewedOnReturn`) and only moves forward, so
  Mark as read in one window clears the other's marks.
- The chip pulses while the summarizer writes and shows a danger glyph on failure,
  with Retry in **Context updates**.

### The pane

On the `subtle` panel surface, one scroll with Goal, Decisions, Summary and
Explanations as sections (`ContextSection`, no tabs).

- Each card has one `⋯`: **Edit**, **Versions**, **Change visibility**
  (`SlotSourceActions`).
- **Context updates** (`ContextUpdates`, a head row whose toggle and action slot
  share one centre line; the tab puts **Copy context** there) says `Updated 2 min
ago`, `Queued`, `Updating…` or `Couldn't update`. Open, it lists the last round
  (`summarizerRounds`: when, turns or a full pass, model and effort, tokens and cost,
  what changed as links to the cards, one value column), **Change model** (Settings,
  This workspace, Models, at Step summaries) and **Update now**, which queues a
  consolidation pass (`requestContextUpdate`) behind any pass in flight;
  `summarizerPending` holds the waiting turns and a queued request.
- The State of the summary heads the tab, above Projects and Linked, as a status box
  built like the merge box (`SummaryStatus`): a glyph, a count of blockers or steps
  left (`summaryStatusWordOf`, never a run state word), the first State sentence, a
  row per blocker and the other State lines; hidden while slots load, fail or show
  Versions.
- Cards read as labelled blocks (`ContextBlock`: eyebrow title, icon, count). Goal is
  one block with the card menu, also while empty, loading or edited (Edit and
  Versions are off during a draft); it shows its key line and folds the rest behind
  **Show N more** (`KeyLineList`, `ContextExpander`).
- A Summary group is a list (`SummaryBlock`): Next as ordered steps, the first
  tinted; Learned and the rest as facts. Each shows three behind one **Show all N**
  (`aria-expanded`); `summaryItems` splits one item per top-level bullet with its
  sub-bullets, or per sentence for prose. Summary shows Next and Learned, then any
  section the summarizer did not name; State is in the status box, Open questions
  are left out (Needs you says them), and **Edit** shows the whole document.

### Decisions

The Decisions card reads the decisions ledger
([turns.md](../turns.md#the-decisions-ledger)) as one list.

- **Changed rows first.** A row changed since you last read
  (`selectContextBaseline`: the `sessionDecisionsBaseline` captured when the drawer
  opened, else `context_seen_at`, so a restored drawer or a search hit shows marks
  too) carries `Added`, `Replaced by 7`, `Withdrawn` or `Reworded`
  (`decisionChangeLabelOf`); a replaced or withdrawn row stays struck through until
  read.
- **Mark as read** (`MarkContextRead`) moves the marker to the click
  (`markContextRead`, saved before the state changes, so a failure keeps the marks and
  reports) and clears the marks and the tool dot.
- **Active rows**, newest first: the number, at most two lines of text, the why as
  one muted line when it has one (two lines, **Show more** when longer), and who
  settled it (`Implementer · turn 9 · 1h`, `You · 2h`, `replaces 5`). A row the
  summarizer reworded says `Goodboy` with **Show previous**. Clicking a row opens
  it, revealing Edit (a reword of yours) and Remove.
- **Remove** withdraws at once, no confirm; the row stays struck through with a
  per-row Undo, and `N changes on this visit · Undo all` shows while any are pending.
  Leaving the drawer drops them into **Replaced and removed**, split by `Removed by
you` / `Replaced` with a search; only your removals offer Restore. A closed row
  points at its replacement (`→ 7` scrolls and highlights) and quotes the reason.
- The dock adds a decision on Enter. While the summarizer writes, rows stay readable
  and edits wait. A new row comes in with `Reveal` (200ms), a reworded text fades in
  (180ms, `animate-text-swap`), both `motion-safe`.

### A decision change in Activity

A `decisions_changed` row with `decisionChanges` is a disclosure (`Show changes` /
`Hide changes`, `aria-expanded`) over a diff: `+ D12`, `D3 → D12` with the reason,
`− D5` with the withdrawal reason, at most six lines, and **Open in Context**, which
opens Decisions with those numbers in `payload.highlight` (2.4s, opening the closed
group if needed).

- Each decision is a three-column grid (sign, id, text): the text wraps beside the
  hanging id, the reason on its own line, never truncated.
- The expanded row adds the diff's height before `layoutTimelineRail`.
  `DecisionChangesDetail` measures itself (a layout effect and a `ResizeObserver`)
  and reports `{ rowId, height }` to `useTimelineRows`, which uses it over
  `decisionChangeDetail`'s first-frame estimate. `Reveal`'s grid element is
  `min-w-0`, so no body widens its column.

## A studio's own panel

A Tasks record opens in the studio's `DrawerColumn` beside the list on the reader
tier (`InboxStudioLayout` passes `sizing: 'reader'` through `useStudioDrawer`); a
window too narrow lifts the pane over the list. Open in the pane header puts the
record at the 720 measure in place of the list (`TaskFullPage`), claiming the band
with Tasks › its key (`StudioTrail`). Escape closes the record before the studio.

## Conversation

`conversation` (`{ threadId }`) is the open comment on the Comments tab, side tier.

- It rides the location's drawer slot next to
  `s/{session}/branch/comments/t/{thread}` (`placeWithThread` keeps both,
  `openReviewComment` writes both), so Back, a list refresh and a reload find it.
- `DrawerHost` renders only a slot (`ReviewCommentDrawerHost`); `ReviewFlow` portals
  the `DrawerFrame` into it, sharing the page's diff, filters, verb controller and
  keys.
- Title: the file and line; meta: author, age, state word, `N of M`. A late answer
  for a comment it left is dropped, the content being keyed by thread.

## Script output

`scriptRun` (`{ scriptKey, mountId }`): `ScriptRunDrawer` reads the run from
`scriptRuns`, which holds the one output subscription per run, so closing loses
nothing. A run records its mount, so a project mounted twice reopens on the right
branch.

- The header action is Stop while running, Run again after (when it cannot run, a
  tooltip says why).
- The body: a status line (state, time, project, branch), a closed `Command`
  disclosure, and the log, following the tail until you scroll up, then offering
  `Scroll to latest`. Error lines carry a danger bar and an `err` prefix; a long
  token wraps at the edge. Under the log: `Following output` while running, then the
  exit, time and Copy output.
- **Add to message**, also while live, queues a text attachment titled `Output of
  <script>, <exit>, <project> on <branch>` (`outputHandoffOf`), opens the session if
  needed, and the composer takes it as a chip and focuses, sending nothing, so a
  running agent is never interrupted. The text is redacted (`redactSecrets`) and
  capped to its last 24,000 characters under a `[truncated: ...]` line.
  

- The same verb sits on a Task or Service row's right click (disabled with `No
output yet`), in the terminal's `⋯` as `Send last output`, and on a terminal
  selection. An archived session or one with no agent hides it. The queue is the
  `outputHandoffs` store key, per agent; a handoff that lands after the composer
  moved to another agent stays queued for the right one.

## File diff and identifier peek

- `file-diff` (`{ source, path }`) peeks at a diff from a worktree (a file opened
  from the chat) or a commit (a GitHub commit link in a session; outside one it
  opens in the browser), unified and wrapped. A worktree peek's Open full page opens
  the Branch Changes tab on that mount with the file in focus; a changed file in
  Explore offers the same arrow, and its `⋯` holds no `Open in Files`.
- `identifier-peek` (`{ worktreePath, word, selected }`, reader width) holds every
  result of the diff's identifier popover; the page does not move
  ([diff-notes.md](diff-notes.md#where-a-name-is-defined)).
- No drawer exists for notes: a note lives on its line in Changes and as a row in
  Comments, and `Fix comments` (kind `fix-comments`) is the one fix action. A note
  without a branch sits in `Unassigned comments` on the Session overview.
