# Lens surfaces

> **Read this when** you change a page of a session that reads one kind of thing, such as comments, files, plans or questions. **Not for** spacing, scroll and overlay mechanics ([styling.md](../styling.md)) or design intent and tone ([DESIGN.md](../../DESIGN.md)). The other pages are listed in [navigation.md](../navigation.md).

## Lens surfaces

- **One header grid for every page.** A 40px band (the crumb at the column's left,
  Ask or Close at its right edge), then one 32px title row directly under it with the
  page's only `h1` (`text-title`) and its actions at the right, the optional meta line
  4px under the row, and the tabs on their own row under the meta line. The title's
  centre is 56px under the pane top and its left edge is the column's content edge on
  every page, studio and sub-page, the Board included (it keeps an empty 40px band
  above its title). The row is fixed (`h-8`, centred, never wraps, a long title
  truncates), no glyph ever indents the title, and the crumb names the structure while
  the `h1` names the object. `frameGeometryOf` (`packages/ui`) is that table.
- **A first-lap session says where it works in one notice.** Before main is on the
  remote the Overview notices slot holds one row, `Not published yet` with Publish
  (`LapPublishNotice`; Retry when the remote did not answer, `Checking the remote`
  while it is read). `FirstLapBanner` keeps only the move card, the move in progress
  and the move report, as a `Notice` in the page banner slot (`PaneBannerContext`).
- **Questions is a list, like Artifacts.** One `ListGrid` (`parts/QuestionsGrid`) with two
  groups, **Needs you** then **Answered**, each counted from two; the grouping is
  `questionGroupsOf` in `questionsLensModel` (a question an agent is answering stays under
  Needs you and says so in gray). A row reads the question, the answer in gray, the
  asker's role and the age; a blocking ask is one warning dot in the leading cell. The row
  opens the question in the drawer (`question` drawer kind, `QuestionDrawer`), titled with
  the asker's role and the age (`questionMetaOf`, the same function as the row) while the
  card carries the question itself. The role in that title is a link to the asker
  (`openAsker`, `features/session/openAsker.ts`): an agent you started opens its
  conversation scrolled to the question, a step of a preset run opens that step on
  the run page, a step of an orchestrated run opens the run with the step in the
  pane (drawer `run-step`). A deleted asker keeps its role with no link. A row's
  right click menu is the registry kind `question` (`features/actions/kinds/question.ts`):
  **Open question** and **Open the agent** (the same `openAsker`, hidden for a
  deleted asker); the card answers, skips, dismisses and undoes; answering moves the drawer to the next
  waiting question. Opened from Ask (a question chip, **Answer question N**), the drawer
  carries **Back to Ask**. The shared `EmptyState` shows only when the session has no
  question at all. Inside the asker's own conversation a question card shows only the question
  (and Blocking as a dot and a word).
- **A lens shows one level. A studio is a rail plus a detail.** Inside a lens,
  selecting a card swaps the list for the detail, and the trail or Back is the
  way back. No lens keeps a rail beside its detail. Review is the one
  exception, because its work happens in bulk: the open comment sits in the
  drawer beside the list, and the list stays visible
  and selectable. A studio pairs a rail with
  a detail and has no back link. Completed and discarded groups sit behind
  header toggles that hide themselves at zero. So a session whose runs are all
  done shows an empty state, instead of opening the last completed run.
- **The Overview is one column: goal, notices, Needs you, Next, Activity.**
  The goal reads as prose (`GoalTeaser`, it opens the Context drawer on its
  Goal), with one gray provenance line under it only when it came from chat
  (`From chat: <title>`, one label whether the chat started or fed the
  session, the others behind `+N more`). The notices slot (`OverviewNotices`) holds what a worktree
  asks the user to decide ([mounts.md](../mounts.md#worktree-rows-and-the-overview-notices)):
  a closed worktree with Reopen, Restore branch or Remove, a failed action with
  `Retry`, a stopped rebase, foreign commits, a branch drift decision (a mount
  follows a branch renamed or switched in its worktree on the next status read
  and logs it as a `Branch` activity row; only a mismatch it cannot follow is a
  `warning` `Notice` with `Use this branch here`, `Keep both branches` and
  `Not now`) and the first lap Publish. Needs you follows, then Next (up to
  three rows, the first one's verb the only filled button on the page), then
  Activity. Projects, Linked work, Artifacts and Add folder live on the
  session rail's session level. Next and Unassigned notes open with `SectionHeader`
  at level 2, and Needs you opens with the same eyebrow on the quiet notice
  surface (no tone bar). Needs you is the one home of a waiting ask on the page:
  its row reads the question with the run or agent in gray after it, no totals
  or repeat counts, and the Activity row keeps only its `?` marker (no amber
  tint, no Needs you word). The page sits on the 960 column of the other session
  pages (`PAGE_MEASURE.overview`). Activity rows carry
  no cost (it is in the duration tooltip and the spend popover), the model line
  holds the effort (`Sonnet 5.5 · Medium`), the day label has no rule and an
  empty Activity reads `Nothing ran yet`. A Next button carries its label only
  and the menu column leaves when no row has a menu. The Activity header holds
  no spend: the session spend lives in the top bar and the spend popover.
  `Mark all seen` is a ghost button in the Activity header and shows only
  while an agent is unseen; a waiting question is answered from its Needs you row, never from a
  second `Answer` on the timeline row.
- **The focused issue page says where the issue lives.** The issue is an
  address (`external-task` target, `focusedExternalTask`): a card opens it
  through `openExternalTaskLens`, so the session trail ends in Issue, its lens
  crumb returns to the list and Back does too. The page draws no back button of
  its own. `Remove link from this session` sits in the record's `⋯`, asks first and
  leaves an Undo toast; once the unlink lands, the address is replaced by the
  lens list, unless the user already moved on. A `Placed on` property in the Links group shows
  `This session` or the branches; its value (`TaskPlacementMenu`) opens the
  same `Move to` menu as the linked task row, `This session` and one entry per open
  branch of the issue's project (`project · branch`, middle cut), the current
  placement checked. `IntegrationPane` hands both to every tracker through
  `RecordFrameContext` (`sessionVerbs`, `linkFacts`), so the loading and error
  states show the placement too.
- **A step chat is one explicit click**, never an automatic redirect.
- **A lens-wide toggle is its own row**, never inside an empty state's action
  slot.
- **Reference beside the work opens in the right drawer, not a rail.** Popover
  = pick one thing in ten seconds; drawer = reference next to the work; page =
  the work. The session context and the Explore file preview open there.
  Creating or configuring stays in a popover, navigating stays in the sidebar,
  and an object you work on is a child page in the trail. See
  [The right drawer](home-and-drawer.md#the-right-drawer).
- **The Branch page is where the session's code is discussed and ships.** The
  contract of its header and tabs is in [The Branch page](branch-page.md#the-branch-page).
  Comments is one flow: the list grouped by delivery (Needs you, Working,
  Ready to push, Open, Done and Left open on its host, the last two closed)
  under the run status line, across the page, and the open comment in the drawer beside it
  (kind `conversation`, side tier), the same pattern as a check opening the Debugger. A comment reads one word (Question for you, Fix ready,
  Push failed, Failed, Working, Applied, Replied, Done, Left open, Open), all from `RESOLVE_WORD_LABEL`
  in `commentProjection.ts` (Applied is a fix on the branch whose reply is not sent, Replied is a
  thread delivered and resolved on the host), and `reviewTally` is the one count behind every number of them.
  The action that takes a fix is `Apply fix` in the comment drawer and `Apply N fixes` in the
  selection bar and the drawer; group labels carry their count and no verbs. A fix run is one agent and one transcript for all its comments: answers, retries and
  hints continue that run, only a model the owner picks starts a new one, and a finished turn
  without a result for a comment reads Failed with Retry, never a question. A thread in the address is
  `s/{session}/branch/comments/t/{thread}`. A comment nobody started has `Fix` in its drawer (and `F`), which opens the **Fix comments** drawer
  (kind `fix-comments`, side tier) with that comment checked; a checkbox on hover picks comments (`X` on the focused row,
  Cmd+A for every fixable comment, open or couldn't fix, Esc clears) and the bar `N selected ·
Fix N` opens the same panel, or `Apply N fixes` for comments with a fix ready. With no fix run
  the line under the tabs says `Fix N`; the Overview card and
  the board card open that same panel pre-filled. Bulk answers, Retry N and
  `N accepted · Undo` (Cmd+Z) are described in
  [Concepts](../concepts.md). Cmd+A is not in the shortcut table:
  the system reserves it. "Resolve" names the area, never a button. The page
  exists with or without a pull request: without one the primary is `Create PR`
  (the creation form replaces the tab body, trail `Session › Branch ▾ › New
pull request`) and Comments lists the session's notes. Every door to a pull
  request lands here: the worktree row chip, the board card badge, the context
  strip and the Checks chip. Everything Comments shows comes from one durable
  conversation model and everything it sends goes out through one publisher, so
  a restart finds the same rows in the same states, and no second path pushes a
  reply or closes a thread. `Write review` is a child state of Files (the diff
  to comment on, then Line comments, Verdict and Summary in one column, and the
  action row at the end); the mode lives in the store per session and drops
  back when the page closes.
- **The resolver stays on its comment.** A resolver exists for one comment, so its
  home is that comment, never the Agents lens, and it has no page of its own.
  The comment shows its agent in one line from the first paint (model, age, the
  state word, and while it drafts the last thing it said). Its transcript opens
  as a drawer of kind `transcript` on the Comments tab of its Branch, in the
  space on the right, so the list and the thread stay where they are: from the
  run status line (**Open transcript** opens the drawer in place and is gone while that run's drawer is open), from `…` →
  Agent transcript on a thread, from the thread crumb menu, from a fix run row
  in Activity, from a notification, the agent-started toast and the palette.
  `fixRunTranscript({ sessionId, agentId, threadId })` builds the move (the
  Branch Comments place with that thread, and the drawer), and
  `canonicalLocation` rewrites every older address to it: an `agentPlace` for a
  resolver, and the former Fix run address (`lens: 'review'` with the resolver
  and a `thread` target, `.../review/t/{thread}/agent`), on a move and on a
  restore from history, which reopens the drawer. The thread is the one the
  address named, or the first thread of the attempt. The drawer takes the
  saved drawer width, like Ask, and holds two tabs under its title, a
  `SegmentedTabs`: Fix and
  Transcript (`FixRunTranscriptDrawer` in `app/components`, which hands
  `AgentTranscriptDrawer` a `lead`; a drawer without a `lead` has no tabs).
  The transcript pane shows only the steps of each turn while the agent's
  conversation is the page beside it, and the whole record otherwise (a fix
  run, an agent opened from another page), so it never repeats the page.
  Fix is the fix run summary at full height with its own scroll
  (`FixRunSummary`: one status line that says each shared fact once, `Working ·
2m 48s · Opus 5.5 · High` while it works and `Done · 8m · 8 fix ready · Opus 5.5
· High` once it ended, and a question the run waits on; the comments the run
  covers, each a row with author, file and line and the first sentence, a link
  that keeps the drawer open on that comment, and the comments fixed together,
  opened filtered in Comments. A state chip sits on a row only while the
  comments differ, in one aligned column; when every row shares one state it is
  in the status line and not on the rows. After it ends, What it did, the run's
  final summary, never shown while it works, and its commits as `sha message`
  rows (no label in front), with a note when a later rewrite folded one, nothing
  while the run works with none, `No commits yet` once it ended without any,
  decided by `fixRunCommitsViewOf` and never an unresolved placeholder. Covers is
  the one filled section; What it did and Commits are quiet labels, not equal
  sections. The count of comments in the drawer and in the run banner comes from
  `fixRunThreadIdsOf`, one agent per launch). Transcript is the transcript as one stream and the
  field to write to that agent; the field is never shown on Fix. The first
  message, the raw brief, is one closed card (`BriefCard`, label from
  `FIX_RUN_COPY.briefCard`, `4 comments from #318`) that opens on click. Only the
  shown tab is mounted. The tab follows the run until the user picks one
  (`useDrawerTabs`): Transcript while the run works, Fix once `fixRunStatusOf`
  says ended or while a resolver question row waits (`fixRunAskingOf`, the
  same rows the summary lists). A pick holds for that drawer instance through
  every later state change; a new drawer starts unpicked. A dot sits on the tab
  that is not shown: on Transcript when its event count grew since it was last
  shown (`New activity`), on Fix, in the warning tone, when the count of waiting questions grew since Fix
  was last shown (`Question waiting`). Arrow keys move between the tabs, the
  `SegmentedTabs` behavior; no global shortcut exists. The scenes
  `resolve-transcript-drawer-multi` and `resolve-transcript-drawer-multi-done`
  show one run over four comments, working and finished. The question card also
  stays in its thread. Accepting, replying, editing and Push live in Comments,
  never in the drawer. In Activity a fix run is one row, `Fix run · #318 · 9
comments`; the Needs you row for the pull request calls `openReview` with the
  destination `{ kind: 'threads', mountId, threadIds: [first comment that waits
on you] }`. Any other agent keeps its page, one conversation with no tabs
  (`AgentDetailPane`): every door lands on it, and the `pane` an address may
  still carry (`agentPlace({ sessionId, agentId, pane })`, kept in the place as
  the target `{ kind: 'agent', pane }` and in `agentPane`) changes nothing on
  the page. The full record opens beside it in the `transcript` drawer, from
  **View transcript**, from "Open in transcript" under a turn's summary line,
  and from a delegation line's **See more** for a child agent. The `threads` destination needs no
  mount and no pull request: Review focuses the first thread of the set it
  has, and the set stays in `reviewSelections[sessionId]`. The destination
  `{ kind: 'notes', threadIds }`, like a `threads` set made only of notes,
  lands on the first note (`noteLandingPlace`): the Files section at its card,
  scrolled to it, when the branch has no pull request, and its thread in
  Comments when it has one. No drawer opens. Back, or Up when
  Review is the entry below, returns to Review with that comment focused, and
  Up from a page reached any other way opens Review on that comment. There are
  no return pills: the Diff and a fix run transcript come back through Back.
- **The switcher and the palette list only destinations the session can
  use.** One function feeds both. Context is a drawer, not a destination: the
  palette offers **Show context** (⌘⌥C) and neither lists a Context page.
  Explore is always listed, opens as a pane (see The session tools), and
  browses one project of the session at a time as a tree (`role="tree"`). It
  draws the shared page header (`PaneShell` `page="explore"` inside the
  drawer's `DrawerFrame isHeaderless`, which keeps Esc and focus): the title
  with no glyph, counts on the meta line (`exploreMetaOf`: `3 folders · 4 files`
  for the root, `7 files changed` in the Changed view, nothing while the root
  loads or is empty), then Refresh and Close at the right of the title row. A
  project chip on the row under the meta (`ExploreProjectChip`) names the
  folder, `ledger-core · hl/ledger-rounding`, and with two or more mounts opens
  a menu grouped by
  project; a first-lap session reads `ledger-core, project folder` and a
  session without a project reads `Session scratch folder`. Picking a row is
  view only: it sets `exploreMountPath` in the session-view slice and never
  calls `switchBranchMount` or `setSessionActiveMount`, and an agent run never
  moves it. Until you pick, Explore follows the write destination
  (`selectExploreMount` in `features/explore`, built on
  `resolveWriteDestination`). A pick whose worktree lost its files reads
  "This worktree is gone", and a session with nothing to browse reads "No
  folder to browse" with one action, Add folder (`DrawerHost` hands it
  in as `noFolderAction`, so `features/explore` does not import the session
  feature). Every empty state is an
  `EmptyState` at page size: a title, one line that says what fills it and at
  most one action ("This folder is empty", "No changes against main", "Couldn't
  read this session folder" with Retry). The `mount.browseFiles` action (Browse files) opens the
  Explore pane on a given mount (`openExplorePane`). An `explore` target in a
  stored place (`s/{session}/explore/{mount}`) still parses and lands on the
  Overview with the pane open. Rows are 40px
  high with no gap (`EXPLORE_ROW_PX`): a type glyph, the name with its
  extension kept, a slot for change marks, the size and the age. The size
  hides under a 520px column and the age under 440px.
  A 16px slot before the size carries the change marks. Changed means what the
  Files tab means: against the base branch, with uncommitted and untracked
  work (`worktree_changed_files`, whose `entries` give each path a status:
  added, modified, deleted or renamed, untracked files count as added). A
  changed file shows the diff's letter (`M`, `A`, `R`; `D` in the Changed
  filter) in the diff's tone, named for assistive tech by the word
  ("Modified"); names are never tinted. A closed folder holding changes shows a
  6px dot, filled with `text-muted-foreground` and a 1px ring so it is never
  mistaken for the diff tree's warning dot (changed since viewed), with the
  tooltip "3 changed files"; an open folder shows none. The mark comes from
  `useExploreChanges`, which shares one request per mount and revision with
  `useMountDiffStats` (same 30s tick, turn finished and focus signals, no second
  timer). The header's `All files | Changed 7` tabs show only for a mount whose
  git answers and that has changes (or while you are in Changed). Changed
  filters the same tree to the changed paths and their folders, all open, with
  deleted files as faint struck rows that do not open; with nothing left it
  says "No changes against main". A changed file's drawer offers
  `Preview | Changes` in its toolbar: Changes is the file's diff in the peek
  presentation with a ghost Open in Files that opens the Files tab on the file. The folders you opened
  are kept per session and project in the session-view slice (`exploreExpanded`,
  keyed by session, mount path and folder) and open again when you come back,
  and a file opened from elsewhere opens the folders above it. The file drawer
  key holds the project (`explore-file:{mount}:{path}`), so the same relative
  path in a second project replaces the drawer instead of closing it. The tree has one tab stop; Up and Down move, Right
  opens a folder or enters it, Left closes it or goes to its parent, Home and
  End jump, Enter and Space open the preview of a file or toggle a folder. Above
  120 rows it draws only the rows near the scroll position (`shared/utils/windowRows.ts`, the
  diff tree's math). A row's verbs come from the `exploreFile` kind, in the
  row's `⋯` visible at rest (`ExploreFileMenu`) and its right click menu: Ask
  an agent (files), Open in editor or Open, Show in Finder and Copy path. A folder
  offers Open only when an editor can take it (a repository with an editor),
  and a linked folder is listed as a folder; the Rust containment check on
  read and open stays. A file opens in a reader drawer whose header reads like
  the diff drawer's: the type glyph, the file name, the one labelled open
  button (`openActionOf`), then 28px ghost buttons for Copy path, Wrap lines
  (code only, `aria-pressed`) and Close. A second row of `Preview | Source`
  tabs shows only for Markdown and SVG, which open as Preview. The open
  failure line and its Choose editor link sit under the header. The body starts
  with the relative path in `text-code`, the folders cut first so the file name
  stays whole, then the size and age faint; there is no divider and no button
  in the body. Code and Source render in `SourceView`: a `bg-muted` well that
  scrolls both ways, a gutter of line numbers drawn by a CSS counter so a copy
  never holds them, and colours from the shared highlighter. Wrap is off for
  code and on for prose, and the code choice is kept in
  `goodboy:explore-wrap:v1`. Past 5,000 lines or a line over 1,000 characters
  the text stays plain and one line says so. A file that is not an image or a
  PDF and is not text says "This file is binary. Open it in the app that owns it."
  Diff and the other branch lenses need a
  branch. Pull request is listed on every code host, GitHub included. A tool
  lens appears once that tool is connected.
- **A lens surface is reached from the overview or from the trail's
  destination switcher, never from a rail.** Rows and chips inside the
  overview route to it, by expanding in place or opening a side panel. Counts
  and dots are read-only signals on the row that routes there. Session
  lifecycle actions are not navigation and do not belong on those rows. A
  count on a row is a promise about that destination. It counts the items the
  destination lists. Every surface that routes to the same destination shows
  the same number from the same selector. A group of items with no home at the
  destination gets no badge pointing there.
- **The session list shows ALL sessions**, never filtered to running only. The
  user's own filter by project and the fold after eight rows hide nothing the
  user did not ask for: a session that needs you is never folded.
- **A blocked action is re-routed, never hidden.** A blocked workflow advance
  gives the reason on the CTA and opens an inline confirm before anything
  starts. With auto-run off, nothing advances without a click.
- **The Agent page always has its header.** Every agent page (the planner,
  Scribe, a missing or loading agent) renders one header row: role chip, title,
  provider mark, View transcript, overflow. The composer model chip always names
  the model the next turn will use, with its provider mark, never a bare
  `Model` word. Each turn footer shows the model chip, the duration and the
  cost; tokens, cache share and context window sit in its detail popover. The
  live tail phrase is present tense in sentence case (`Collecting the output`).
  The transcript pane's usage footer drops the turn count when the agent has no
  turn of its own to count, instead of reading `0 turns`.
- **An Artifacts row is the button, with one verb at most.** A row keeps a
  visible verb only where it is its own: the state-driven primary (`Run plan`,
  `Approve`) on a Needs you row, `Stop` on a running generation, `Restore` in
  Recently deleted; the column leaves when no row has one. Every other verb
  (Edit, Open in browser, Copy source, Delete, Delete permanently) lives on
  right click and in the opened artifact. No kind column (the glyph says it);
  the state cell shows only what the group does not say, as one glyph and word
  with the progress (`part 2 of 4`) in its tooltip. An artifact page header
  draws no state chip: the state leads the gray meta line. A report shows its
  title only in the document, the header keeps a hidden `h1`.
