# The Comments tab and fix runs

> **Read this when** you change the Comments tab of the Branch page: its list, the open comment drawer, the comment words, `Fix comments`, a fix run's drawer or a count on a Comments surface. **Not for** threads drawn in the diff ([diff-notes.md](diff-notes.md)), pushing the fixes ([branch-push.md](branch-push.md)) or bulk answers and Undo ([concepts.md](../concepts.md)).

Comments is one flow: the list across the page, and the open comment in the drawer
beside it (kind `conversation`, side tier), the same pattern as a check opening the
Debugger.

- It exists when a pull request exists or any comment does, a local note or a
  thread open or resolved. Without a pull request the primary is `Create PR` (the
  form replaces the tab body, crumbs `Overview › Branch ▾ › New pull request`) and
  Comments lists the session's notes.
- Everything it shows comes from one durable conversation model and everything it
  sends goes through one publisher, so a restart finds the same rows in the same
  states and no second path pushes a reply or closes a thread.
- "Resolve" names the area, never a button.

## The list

One 36 toolbar (`ReviewToolbar`): the source switch `All 9 · Notes 3 · On GitHub 6`
(only while both kinds exist), `Open 5 · Resolved 12` (from the first thread on, the
Open count warm while a thread needs you, with the quiet count of a batch fix), and
`Fix N comments`, the one fix action, with the fix run on the same row.

- Groups by delivery: `Needs you`, `Working`, `Ready to push`, `Open`, `Left open on
GitHub`; `Done` under `Resolved`. Labels carry their count and no verbs.
- A row: the author and age, `path:line`, the body's first line (`commentPreviewOf`
  drops heading hashes, HTML comments, severity badges, images and bot boilerplate)
  and a `Note` chip only while sources mix.
- A note keeps `Post to GitHub` (moving it into the pull request's review draft and
  closing it) and `Delete` under its thread, and shows even while the host is still
  loading or failed.
- One full-width list at every width, no back link; the last row opened stays marked
  after the drawer closes.
- **One word per comment**, from `RESOLVE_WORD_LABEL` in `commentProjection.ts`:
  Question, Fix ready, Push failed, Failed, Fixing, Fixed (a fix on the branch whose
  reply is not sent), Replied (delivered and resolved on the host), Done, Left open,
  Open. `reviewTally` is the one count behind them.

## The open comment

`ReviewCommentDrawer` ([drawer-kinds.md](drawer-kinds.md#conversation)):

- a 40 header, `Comment · 4 of 8`, with the menu and close;
- the author row (`CommentDrawerAuthor`: picture, name, age, state chip) as content,
  the file and line as a mono line under it;
- the code around the line above the thread (`hunkAround`, linking to Changes);
- the proposed change as a file card (`FileChangeCard`, reusing `FileHeader` at 32),
  its verbs in one 32 row with one primary;
- the properties (Origin, Attempts, Fix commit) inline under the thread, never in a
  margin rail;
- the actions at the end of the content through `FormActions`
  (`CommentDrawerActions`), never a bar pinned to the page bottom;
- the header `⋯` holding the transcript, Resolve without a reply, Open on the host
  and Copy link, shown only with two or more of them (one shows as a quiet button).

Accepting, replying, editing and Push live in Comments, never in a fix run drawer.

## Fixing comments

1. A comment nobody started has `Fix` in its drawer (and `F`), opening the **Fix
   comments** drawer (kind `fix-comments`, side tier) with it checked.
2. A checkbox on hover picks comments: `X` on the focused row, Cmd+A for every
   fixable one (open or failed; not in the shortcut table, the system reserves it),
   Esc clears.
3. The bar `N selected · Fix N` opens the same panel, or `Apply N fixes` for comments
   with a fix ready.

- With no fix run the line under the tabs says `Fix N`; the Overview card and the
  board card open the same panel pre-filled.
- A fix is taken with `Apply fix` in the drawer and `Apply N fixes` in the bar.
- **A fix run is one agent and one transcript for all its comments.** Answers,
  retries and hints continue it; only a model the owner picks starts a new one. A
  finished turn with no result for a comment reads Failed with Retry, never a
  question.

## The resolver stays on its comment

A resolver exists for one comment, so its home is that comment, never Runs, and it
has no page. Its transcript is a drawer on the Comments tab, so the Branch page
keeps its crumbs.

- The comment shows its agent in one line from the first paint: model, age, state
  word, and while it drafts the last thing it said.
- The transcript opens as a `transcript` drawer on its Branch's Comments tab, the
  list and thread staying put. Doors: the row while it works (**Open transcript**),
  the batch count's menu, `…` → Agent transcript on a thread, the thread crumb menu,
  a fix run row in Activity (`Fix run · #318 · 9 comments`), a notification, the
  agent-started toast and Search or run.
- `fixRunTranscript({ sessionId, agentId, threadId })` builds the move (the Comments
  place with that thread, plus the drawer), on the thread the address named or the
  attempt's first. `canonicalLocation` rewrites every older address to it (an
  `agentPlace` for a resolver, the former `lens: 'review'` with the resolver and a
  `thread` target, `.../review/t/{thread}/agent`), on a move and on a restore, which
  reopens the drawer.

### The fix run drawer

The saved drawer width, like Ask, and two tabs under the title, a `SegmentedTabs`:
Fix and Transcript (`FixRunTranscriptDrawer` in `app/components`, handing
`AgentTranscriptDrawer` a `lead`; no `lead`, no tabs). Only the shown tab mounts.

- **Fix** is the run summary at full height (`FixRunSummary`): one status line
  saying each shared fact once (`Working · 2m 48s · Opus 5.5 · High`, then `Done ·
8m · 8 fix ready · Opus 5.5 · High`) and a question the run waits on; the comments
  it covers, each with author, file, line and first sentence, a link that keeps the
  drawer open on it, and the comments fixed together, opened filtered in Comments (a
  state chip per row only while states differ, else in the status line); after it
  ends, What it did (never while working) and its commits as `sha message` rows, with
  a note when a rewrite folded one, nothing while working with none, `No commits yet`
  once ended without any (`fixRunCommitsViewOf`). Covers is the one filled section.
  Drawer and run banner count comments with `fixRunThreadIdsOf`.
- **Transcript** is one stream plus the field to write to the agent (never on Fix).
  The raw brief is one closed card (`BriefCard`, `FIX_RUN_COPY.briefCard`, `4
comments from #318`).
- The drawer reads **Steps** (tool rows only) while the agent's conversation is the
  page beside it; otherwise it holds the whole record, never repeating the page.
- **The tab follows the run** until picked (`useDrawerTabs`): Transcript while it
  works, Fix once `fixRunStatusOf` says ended or while a resolver question waits
  (`fixRunAskingOf`). A pick holds for that drawer instance; a new drawer starts
  unpicked. A dot marks the hidden tab: Transcript when its event count grew (`New
activity`), Fix in warning when waiting questions grew (`Question waiting`). Arrow
  keys move between tabs; no global shortcut. The question card also stays in its
  thread.

### Other agents and destinations

- Any other agent keeps its page, one conversation with no tabs (`AgentDetailPane`),
  its address naming only the agent (`agentPlace({ sessionId, agentId })`); its steps
  open beside it in the `transcript` drawer from a turn's summary line and **Open
  transcript** on a failure.
- The Needs you row for the pull request calls `openReview` with `{ kind: 'threads',
mountId, threadIds: [first comment that waits on you] }`. A `threads` destination
  needs no mount or pull request: Review focuses the set's first thread, and the set
  stays in `reviewSelections[sessionId]`.
- `{ kind: 'notes', threadIds }` lands on the first note (`noteLandingPlace`): the
  Changes card, scrolled to it, without a pull request; its thread in Comments with
  one. No drawer opens.
- Back, or Up when Review is below, returns to Review with that comment focused; Up
  from a page reached otherwise opens Review on it. No return pills: the Diff and a
  fix run transcript come back through Back.

## One function per number

- `commentStateCountsOf` counts threads: `open` is every thread not done or replied,
  one left open on the host included; `need you` the asking, proposed, failed and
  fixable ones.
- **The Comments tab count** is those two over every branch thread, notes included,
  read by `pullRequestThreadCountsOf`, which the merge box reads too; until the queue
  loads both show the unresolved host thread heads. Its open count is the switch's
  `Open` under `All`; under `Notes` or `On GitHub` the switch counts that source while
  the tab keeps every branch thread.
- **The pull request page** counts the `On GitHub` source (the merge box, the
  Activity line, the review apps;
  [branch-conversation.md](branch-conversation.md#the-activity)).
- `commentsCountOf` counts the same open threads for the merge label and actions,
  a thread left open on the host unresolved too.
- **During a fix of two or more comments** the bar reads `Fixing · 2 of 3`
  (`fixRunCountOf`, the comment in work after those finished), and the Comments tab
  dot's tooltip `Fixing 2 of 3 comments` (`fixRunPhraseOf`).
- **The drawer position** `1 of 8 comments` is the length of the walked list: every
  branch thread, notes and threads left open on the host included.
