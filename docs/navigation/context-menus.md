# Context menus and the action registry

> **Read this when** you add a verb, a menu, a visible action control, a selection bar or a confirm, or a row that answers right click. **Not for** the palette's ranking ([palette.md](palette.md)) or the menu bar ([shell.md](shell.md#menu-bar)).

Every object's actions are written once, in the action registry
(`features/actions/`). A kind (`kinds/session.ts`, `kinds/agent.ts`,
`kinds/artifact.ts` and the rest) lists each verb with its label, icon, group,
shortcut from `SHORTCUTS`, when it shows, why it is blocked, and its confirm or undo
rule. `useObjectActions` resolves one target's verbs live from the store, and
`useActionEnv` runs them. The overflow menu (`ObjectOverflowMenu`), the right click
(`useObjectMenuTrigger` and the one `ObjectMenuProvider` in `App`) and the palette
read the same list, so a verb never lives on one surface only.

## Rules every menu keeps

- **Visible actions.** The primary is a visible, labelled button; frequent
  alternatives stay beside it or on their row; `⋯` holds copy and rare actions.
- **One order**: Open, Act, Copy, then stop, archive and destructive verbs after one
  rule. `MenuList` draws rules only from five rows up, and an icon on every row or
  none (`menuShapeOf` in `packages/ui`).
- **No verb that does nothing.** A surface says what it shows through `env.viewing`
  (`useActionEnv`, `ObjectOverflowMenu` and `useObjectMenuTrigger` take
  `viewing`): the artifact viewer its artifact, the agent header and messages
  (`TranscriptViewingContext`) its agent, the run page its run. Open, Open agent and
  Open run are never offered for the object on screen.
- **Blocked verbs stay**, dimmed on one line, the reason as the tooltip and the
  row's description, doing nothing when chosen. A verb that does not apply to the
  state is not shown.
- **Every menu renders through `AppMenuList`** (radio entries for pickers, items for
  verbs); only `packages/ui` primitives write `role="menu"`, `menuitem`,
  `menuitemradio` or `menuitemcheckbox`.

## What each object offers

| Object           | Verbs                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A session        | Open, Comments, Changes, Open in Terminal (one per worktree in ⌘K, the first in the menu), Open in editor; Rename (inline, in the row that opened the menu); Start next steps without asking or Ask before starting each step; Start a run; Link work (L on the Overview); copy the title, worktree path, branch and pull request link; Archive (confirm, Undo); Delete (confirm); Restore once archived |
| Several sessions | Copy titles, Archive N, Restore N, Delete N                                                                                                                                                                                                                                                                                                                                                              |
| An agent         | Open agent, Show its changes; Message this agent (not on its own page); Interrupt while a turn runs; Close or Reopen; Let the Lead take it from here (an old standalone agent of a standard role); Detach from the Lead (a moved agent); Change model; copy the name; Delete agent                                                                                                                       |
| A workflow run   | Open run, Open in Changes; Answer, Start run, Continue, Restart step, Start the next step, Restore; Copy run summary; Stop run, Archive run, Delete run, each confirmed                                                                                                                                                                                                                                  |
| An artifact      | the viewer's verbs by kind and status, from the list row too; Delete on a live artifact (Undo, no confirm); Delete permanently on a deleted one (confirmed)                                                                                                                                                                                                                                              |

- The session's asks setting is the default of a run started without its own and of
  agents outside a workflow; the Runs header has no switch.
- **Archive N** asks once with the same `archiveConfirmOf` ("Archive 3 sessions?",
  summing `runningAgentCountOf`, saying running agents keep running). Cancel
  archives nothing. A partial failure archives the rest with Undo and names the
  sessions it could not archive above the bar, with Retry for those only. Archive
  instead on the Delete N confirm archives at once.
- Other kinds: a plan part, a Tasks record (with an open record's tool verbs), a
  pull request, an Overview worktree row (`mount`), a project, a branch's Diff
  (`diff`), a diff file, an Explore row (`exploreFile`), a commit on the rewrite
  page, a storage worktree, a script, a transcript message, a link in rendered text.

### The Next card kind

A Next card is its own kind (`suggestion`, `kinds/suggestion.ts`). Its target holds
the suggestion as data (the suggestion, the role the primary starts, whether Auto is
on), no closure, and its verbs are the card's other answers, its **⋯** items:

- Continue with Tester and Continue with Implementer on a check-changes card, each a
  message to the session's Auto run through `continueWithRole`, or a role started at
  once when there is none;
- one verb per project (`suggestion.rebase.<target id>`, built by `adapted`) on a
  rebase card with two or more;
- Talk it through with Auto (`suggestion.talkWithAuto`) on a card that starts a role.

The handlers live in the kind (`continueWithRole`, `startRebaseTarget`,
`startTalkItThrough`); the row adds only the pending and accepted bookkeeping
(`track`).

### Linked tasks

A linked task is one row of the session's Linked group (`LinkedTaskRow`): a click
opens it, a drag moves it, and Open in Linear (its tracker), Unlink, Move to and
Remove from this branch sit in its right click menu (⇧F10), with no kebab or hover
control. `Link work to this branch` (`mount.putTaskOnBranch`) sits on the Overview
branch row and in the Projects tree row menu; Link work is the single entry for
linking work. Moving is one verb, `Move to`, in the row's menu, the focused issue's
`Linked to` row and the palette.

### The Board session card

Its right click (and ⇧F10) opens the session kind's menu:

1. **Open**: Overview, Comments, Changes, Log, Editor, Terminal, External terminal;
   a verb that cannot run stays with its reason as a tooltip.
2. Rename, Pin session or Unpin session, Mark as read, Start a run, Link work,
   **Set limit…**.
3. **Copy**: Title, Branch name, Worktree path, the pull request link (named by
   `requestNounLabel`).
4. Stop all running agents (at once, its toast offers **Continue**), Archive (at
   once, **Undo**) and Delete, whose confirm still asks.

`withSessionSubmenus` (`kinds/sessionGoToActions.ts`) tags the Open and Copy rows,
and `toMenuEntries` folds a group of two or more into its submenu (one row stays
flat). A child with choices (Worktree path with several worktrees) opens its chooser
beside the submenu (`MenuList`).

Verbs with `placement: 'palette'` show only in ⌘K: Ask about this session, Refresh
session, Write title and goal, Select, Move up or down, and the run setting. The run
setting also sits in the Set limit form: the box follows the live setting until you
tick it, a save whose limit landed but whose run setting failed says so, and Save
again sends only the run setting. The header `⋯` (`sessionMenuOf`) holds Pin, Link
work, Copy, Archive and Delete. The card is `select-none`, like every row with
`ROW_HOVER` or `ROW_INTERACTIVE` (`SelectableRow`, `InteractiveRow`, `ListGridRow`).

## Visible controls and action runs

`slot` says which available actions also get a visible control: `primary`,
`secondary`, `inline`, `nudge`, `notice`, `hover`, `section`, `chip`, `empty`, or
`menu` (the default, menu alone). A surface reads its buttons from it (the artifact
viewer header, the Branch header, the worktree row), at most one primary and three
secondaries; the menu, the right click and the palette ignore `slot`.
`useActionControls` draws them with the pending words on the control, the blocked
reason under the header, and a failure with Retry under the control.

### One run per target

Runs live in the `action-runs` slice (`store/slices/action-runs/`), one per target.
`actionRunKeyOf` names a pull request by session and mount and a diff by session and
worktree, so the Branch header and every surface on that target share one busy mark,
refuse a second press and show the same result, even after the starting surface
unmounts.

- Every mounted controls hook is a surface of its key. A settled run is dropped when
  the last surface unmounts and when its session is deleted; a failure that settles
  with no surface left is logged unread.
- A pending run older than ten minutes resets when a surface mounts again.
- Another kind keeps a run per hook instance, dropped on unmount.
- A confirm that meets a run another surface started stays open.
- The Branch overflow runs close and convert to draft through the same controls.

### Pending and done words

- A button reads `pendingId` through `actionButtonStateOf`: busy, `pendingLabel`,
  the elapsed seconds after three, disabled.
- A mutating action defines `pendingLabel` and `doneLabel`. When it ends,
  `ActionRunLine` (under `ActionStatusLine`) shows the `doneLabel` sentence with a
  dismiss button until the next action; a run returning `'unchanged'` (a rebase that
  stopped or went to the history rewriter) shows none.
- The controls set `isOutcomeShown` and `hasRunSurface` on the env, so a pull
  request write failing with a surface mounted is logged as a read row with no
  toast, and Merge and Mark ready skip their toast; the palette keeps them.
- The Mark ready done line keeps a Follow button to the pull request tab (`doneTo`)
  while that tab is not open.

### Preview, tint and held rows

- A verb may carry a `preview` (a role today). A menu given `onPreview` calls it
  with the descriptor while the row is hovered or focused, and with `null` when it
  leaves or the menu closes; the surface draws it (the Next tile shows the role).
- `iconClassName` tints a verb's icon (the role colour).
- A verb that opens a host page writes no host word: `label` `Open`, `iconOf` the
  host logo (`shared/components/hostIconOf`), `ariaLabel` the spoken `Open on
GitHub`, read by the menu row, the bar verb, the button and the palette. The host
  is a logo, never text.
- `ObjectOverflowMenu` also takes `track` (wrapping every run: pending keys,
  accepted outcomes) and `isHeld` (a row visible but unable to run: `isDisabled`,
  `aria-disabled`, description kept). All three are optional, and no other surface
  sets them.

## Pointer, keys and focus

- The menu opens at the pointer and flips to stay 8px inside the window. ⇧F10
  (`menu.open`) and the Menu key open it on the focused row; Control-click is a
  right click.
- Arrows, Home and End move, typing jumps to the first match, Enter runs,
  ArrowRight opens the one submenu level, Escape closes and returns focus. The row
  acted on keeps a primary outline (`data-menu-open`) while the menu is open.
- **Focus after a removal.** A verb that removes its row (archive, delete, close)
  leaves focus on the next row, across a group, or the one before on the last row.
  The right click and `⋯` capture the neighbour before the write (`keepRowFocus`, on
  `captureReturnFocus`). Rows carry `data-row` (`ListGridRow`, `InteractiveRow`, the
  rail branch row, the Overview branch tile) or `data-select-id` (the Board card), so
  a redrawn neighbour is found again. The search stays in the row's landmark: a
  list's sole row hands focus to its list. Undo puts focus back on the restored row
  once done; a row that only changes keeps focus. `ActionConfirmPanel` passes the
  same `returnFocusTo`.

## Selection

- **Like Finder.** A right click on a row in a multi-selection acts on the whole
  selection (the several sessions kind, the several chats kind); on an unselected
  row it clears the selection and acts on that row.
- **One selection bar.** The Board, the chat list, Review, Branches and the Storage
  lists share `SelectionBar` (`packages/ui`), floating at the bottom of the owning
  surface with Clear, the count, Select all and the verbs; the scroller takes a
  bottom margin so the bar never covers the last row.
- The sessions bar takes its verbs from the `sessions` kind through
  `ObjectSelectionBar` (`shortLabel` on the bar, `label` as the accessible name);
  the chat list does the same with `chats` (Archive, Delete).
- A verb that undoes runs at once with the Undo toast; one that does not asks in a
  confirmation above the bar with what goes and stays (`goes`, `stays`, `items`,
  `altActionId` on `ActionConfirm`).
- The bar's `aria-live="polite"` dock announces `n selected`; with a session
  selected, a quiet line under it reads "Shift click for a range, Option click to add
  one".
- **Board cards draw no checkbox.** A card is its optional ticket key, its title and
  its state node (never hidden). The selection is a modifier click (Shift for a
  range, Option, Command or Control for one), Shift+Enter, Alt+Enter and Alt+Space on
  the focused card, Shift+Arrow, X on the hovered or focused card, Command A, and
  **Select** in the row menu (`session.select`, only from a row or card, through
  `viewing: { kind: 'selection' }`, delivered by `requestSelect` and
  `useSelectRequest` like Rename). A card keeps `aria-pressed` on its title button,
  its state word as the description. Chat rows, Review, Branches and Storage keep
  their checkbox (on chat rows in the state node's place, `StateNode`
  `isCheckboxSlot`). The lasso stays.
- The keys are the registry's `selection` group (`selection.toggle` X,
  `selection.all` ⌘A, `selection.clear` Esc, `selection.delete` Delete), run by
  `useSelectionKeys` only while the pointer or focus is in the list. Esc goes through
  the escape stack: the confirmation first, then the selection. Review keeps its own
  `review.select` and `review.selectAll`.

## Confirm and undo

- **A confirm is one placement**, anchored to its trigger (`ConfirmPopover`): Cancel
  has focus on a danger confirm, `Cmd+Enter` confirms, and there is no card confirm
  (`inline-confirm-placement.baseline.json` is empty).
- **A verb that loses work confirms on its button**: Delete, Delete permanently,
  Discard, Close run, Merge ("Merge #318 into main?"), Close pull request ("Close
  #318 without merging?"), Delete script, Close branch, Unmount, Abort rebase,
  Restore a backup, and a pull request review draft. Remove from session and a
  storage worktree's Remove keep their detailed confirm in their own menu.
- **A reversible verb runs at once with Undo**: Archive, Delete on an artifact,
  Close agent, Unlink, Stop tracking, Remove from this branch, deleting a diff note
  (Undo posts it again), removing a commit on Commits. Reversible removals never ask
  ([model.md](model.md#undo-operations)).

## Where the webview menu stays

Every object row answers right click with its object menu, never the webview's.

- A row whose object has verbs elsewhere takes that kind: a changed tree file
  `diffFile` like the diff file header, a review or fix comment row
  `reviewComment`, a Context question card `question`, a check run `checkRun`, a
  decision change `decision`, a switcher workspace `workspace`, an issue to start
  from `issueCandidate`, and a central branch row the rail branch's `mount` from
  `useMountRowMenu` (one source, so status and host verbs match).
- A row with no verbs reuses the nearest object's kind (a GitHub issue row `link`, a
  worktree page row its branch's `mount`); a row with no object (a Done row, a
  folder in the changed tree, an Activity decision or history batch row) takes the
  generic `item`: Open with its own label, and Copy name. A link in rendered text
  gets Open link and Copy link.

The native menu stays in three places (`useNativeMenuPolicy`, `keepsNativeMenu`):

1. editable fields and the composer (a checkbox or radio is a row);
2. the terminal;
3. text selected before the right click inside a reading region
   (`data-reading-region`: `Markdown`, `TranscriptShell`, the workspace chat thread,
   `SourceView`, `DiffView`, `ArtifactDocument`).

A selection the right click made never counts (the policy reads it at the press),
and chrome never counts: rows are `select-none` through `ROW_HOVER`. Elsewhere the
webview menu and its Reload are suppressed, and a blank area opens nothing.

## Tests

- `__tests__/actions/menuParity.test.tsx` checks registry parity across surfaces;
  `stateMatrix.test.ts` pins, per kind and state on the real store, which verbs
  show, in which slot and why blocked; `kinds/*.matrix.test.ts` pins the same per
  kind.
- `__tests__/actions/handBuiltMenus.test.ts` fails on a hand-built menu outside the
  registry (against a shrinking list of non-object menus) and, with no allowlist, on
  a menu role written in `features/`, `app/` or `shared/`.
- `kinds/mutationFeedback.test.ts` fails a new async diff or pull request action
  without `pendingLabel` or `doneLabel`.
- `object-rows-open-our-menu.test.tsx` right clicks every row type in its scenes and
  fails on a row that opens no menu.
