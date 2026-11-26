# Feedback and empty states

> **Read this when** you build a notice, action feedback, an empty state or a question card. **Not for** tokens and scales ([DESIGN-SYSTEM.md](../DESIGN-SYSTEM.md)) or intent and product judgment ([DESIGN.md](../../../DESIGN.md)).

## Notices

`Notice` is the one shape for an error, a warning, an info line or a success
that sits in the page. Its tone lives only in the 16px icon. The surface stays
neutral, the title is `foreground` and the body is `muted-foreground`. Tone
never colors the text, fills the surface or draws a line.

- **Tone**: `danger` (`CircleAlert`), `warning` (`TriangleAlert`), `info`
  (`Info`), `success` (`CircleCheck`), always at `ICON_SIZE.notice` (16px). A notice for a named
  concept may replace that mark with the concept icon while keeping the tone's
  color and the same size.
- **No tone line, no border.** `inline` and `banner` sit on `bg-subtle`,
  `rounded-md`, 12px padding, with no border, no ring, no `ToneBar` and no
  side rail: a side line on a rounded box is the debt the design system
  retires, and the icon already says the tone. `transcript` is the one
  exception: it keeps a 2px edge at the left of its transparent surface,
  because there it is a quote rail, not a box. `floating` (toasts) takes the
  one floating surface, `FLOATING_SURFACE`, like every other level 4 layer.
  `tone-edges-are-inner-lines.test.ts` counts `border-l-2` next to a tone
  class per file, and its allowance only shrinks.
- **Placement** changes the surface and padding, never the anatomy.
  `transcript` is transparent with no border, `inline` and `banner` sit on
  `bg-subtle`, `floating` sits on `FLOATING_SURFACE`.
- **One notice per state, one primary.** A state that already has a notice on
  the screen never gets a second box saying it again.
- **Title names the action** that failed ("Couldn't load pull requests"). The
  body states the cause in plain words. Raw output (stderr, exit codes, paths,
  URLs) goes in `detail`, which renders behind a Details disclosure in
  monospace. `splitErrorMessage` decides whether a message is a readable
  sentence or raw output.
- **Actions stay neutral**: `Button variant="secondary"` for the recovery,
  `ghost` for an alternative. Never a tone-colored button.
- **Actions follow the notice's own width.** The notice is an
  `@container/notice`. From `@md` (28rem) the actions sit to the right of the
  text, top-aligned with a multi-line notice and centred on a title-only one.
  Below it they drop onto their own row under the body, aligned with the
  title, and wrap. Text never shrinks to make room for a button.
- **Children** render under the body at full width, for live work the notice
  owns, such as the terminal of a CLI update running inside the card.

Every message shape in the desktop app renders through it. `ErrorStrip` is the
one shape for a failed load, an inline danger `Notice` with Retry and Details
(Empty states, state 4). It takes `labels`, so two failed reads of one view share one strip. Budget alerts
and the unpriced-turns warning are banners. Guide tips, the partial brief after a step,
the branch switch confirmation and merge conflicts are `inline`. So are three
failures with the raw message behind Details: the wireframe viewer ("Couldn't show
the pages", with Retry), the Scribe's pull request text ("Couldn't write the
pull request text", with Retry) and the first-lap publish steps. The publish panel's missing GitHub tool is an
`inline` `warning` Notice that holds the install command with `CopyButton` as
its children and **Check again** as its action. A page that
cannot load its list is an `inline` `danger` Notice with `role="alert"`
(Empty states, state 4), and the startup error screen is the same Notice. The
sign-in prompt in the chat is `transcript`. Toasts are `floating`: the toast
card owns only its timer, hover pause and dismiss, and passes its action and a
ghost dismiss button as the Notice actions. Chat errors in the desktop app go through `formatErrorForHumans`, which
turns a known provider failure into a sentence and keeps the raw text as the
detail.

## Action feedback

Every click that starts work answers at once, on the control that started it,
and answers again when the work ends. The product rules live in
[DESIGN.md](../../../DESIGN.md) → Status & signals; the mechanics are here.

- **Pending is on the control.** The button that started the action takes
  `isBusy` (`Button`, `GhostActionButton`, `InlineConfirm`, `CardAction`) or
  `busy` (`IconButton`, `RefreshIconButton`, which takes `isLoading`): the
  pulsing glyph, `aria-busy`, and disabled against a second submit. A
  picker that closes on its pick (the reviewer picker) keeps its trigger busy
  and names what it is waiting for in one muted `role="status"` line under
  the field. A switch is disabled while it saves. Never a spinner, never a
  toast that says "started" when the control already says it.
- **Success is the new state.** The action refetches exactly the state it
  changed (the mount's request, the worktree status, the resolve rows), so
  the screen shows the result without a reload. A toast adds nothing when the
  result is on screen; it is only for a result that lands somewhere else, like
  an agent started with `focus: 'none'`.
- **Failure is one log row.** The error goes to `reportError` with a title
  that names the action ("Couldn't push the branch") and the real message as
  its body. Recovery is required: an action or an audited sentence from
  `apps/desktop/src/store/slices/notifications/errorRecovery.ts`. Only a path
  that made no change uses Nothing was changed. A read suggests loading again;
  a partial or uncertain write asks you to check the current state first.
  `hostErrorRecoveryOf` offers tool settings for rejected credentials and the
  neutral sentence for other failures. The toast is its preview. The control comes back enabled, so the
  click is the retry, and the row stays as it was. A field the user is typing
  in shows `FieldError` instead, and a form the user is still looking at keeps
  its error next to its actions, as DESIGN.md says. Never a toast, an inline
  banner and a suggestion for the same outcome.
- **One action, one row.** When one action fails on several objects with the
  same title, the failures fold into one row with the count and one Retry
  ("Couldn't delete 2 local branches"), never a row and a toast per object. An
  action that runs offline lights one toast, not dozens. `reportErrors` takes
  the failures of one action and a group title, and writes one row; one failure
  keeps its own title. A `retry` passed to `reportError` or `reportErrors` is
  the row's Retry, in the toast and in the bell, and a retry that works clears
  the row. It lives in memory only: after a restart the row keeps its sentence
  and has no Retry. A `stays` sentence takes the place of the clause when the
  action can name what stayed ("GitHub is still connected."). The title names the
  real object ("Couldn't merge pull request #412", "Couldn't delete the local
  branch hl/fix-duplicate-credit"), and the raw detail goes through the same
  redaction as the log.
- **A result line is the one channel.** A control that keeps its result in
  place shows it with `ActionRunLine`
  (`apps/desktop/src/shared/components/ActionRunLine.tsx`): a
  `role="status"` done line with Dismiss, or a danger `Notice` with the reason
  and Retry. Its failure is still logged, as a read row with no toast while a
  surface of the run is mounted and as an unread row when none is left, and
  its success never toasts. A done line may keep a Follow button when the
  toast it replaced navigated. A slow run adds its elapsed seconds to the
  busy word after three seconds.

The registry buttons run through the `action-runs` slice
(`apps/desktop/src/store/slices/action-runs`): `runAction({ key, actionId,
choice, task })` claims the target key, refuses a second claim while one is
pending, and applies the result only while its token is current, so every
surface on one target shows the same busy mark and the same line.
`useActionControls` is its client. A registry `run` awaits or returns its
work, never `void`s it, or the button is idle while the work runs and the
failure never reaches the line; `registry-runs-return-their-work.test.ts`
fails a run block that fires its work and forgets it.

`usePendingAction` (`apps/desktop/src/shared/hooks/usePendingAction`) is the
runner for a control with no result line: `run({ key, failureTitle, task })` keeps `key` in `pendingKeys`
until `task` settles, drops a second run of the same key, reports a thrown
error once through `reportError` and resolves to whether it worked. A store
action that already logged its failure throws `ReportedError`, and a turn error
the transcript already shows counts the same (`isReportedError`), so the runner
never logs one failure twice. A store verb never turns a missing target into
a quiet no-op: the pull request writes resolve their target through
`prWriteContext`, which logs and throws `ReportedError` when the session,
workspace, pull request or repository is missing. Every next-step suggestion
runs through the runner: `SuggestionAction.run` returns a promise and carries its `failureTitle`, and
`useSuggestionRunner` owns the runner (`useSuggestionActions` test guards every kind).
A suggestion's `choices` (a rebase target, "Start tester instead") are items of
the `⋯` menu of the board row, run through the same runner
under their own key, and hold the row's other controls while one runs.

### Agent work on an item

Work an agent does for one item (a failing check, a review comment, a failed
push) shows on that item, never in a status line above the list. The item is
the place of its work from the click to the result.

- **The click.** The button that started it is busy (`isBusy` through
  `usePendingAction`) until the agent exists, and the item reads Starting. A
  second click does not start a second agent. Starting stays local to the
  window that clicked; every word after it comes from stored agents and
  attempts, so a second window reads the same word.
- **The work.** One `ItemWorkLine`
  (`apps/desktop/src/features/live-state/itemWork/ItemWorkLine`) under the
  item's title: the node, the word, the step in a few words from
  `agentStepPhraseOf` (the open tool, else the last line of the agent's text)
  and the agent's active time. The time comes from `WorkTimeContext`, so it
  holds still while the agent waits. Stop and Open transcript sit in the
  line's `verbs`, drawn with `row-actions` on a `group/row`: shown on hover
  and focus, always in the tab order, and always in the item's `⋯` menu.
  `ItemAgentVerbs` draws the pair for one agent; Stop is busy while its
  request is out and offered again once it stalls.
- **The result.** The same line says what happened in one sentence and offers
  one action in its `action` slot, visible at rest: Review fix, Review, Apply,
  Push, Retry, Analyze again, Open changes. A word never only describes the
  agent; it says what you can do next. A result you read before acting opens
  under the item, not in a drawer: Review fix shows a check's proposal with
  Apply fix and Dismiss below its row, and the drawer keeps the full detail.
  Failing checks do this (`checkRowResultOf`, `CheckProposalInline`),
  and so do review comments (`commentRowResultOf`, `CommentFixReview`:
  Review shows the diff with Apply, Retry with a hint and Discard). Retry
  starts a new attempt; the row reads the newest one, and while it starts the
  line reads Starting with the Retry busy. A finished batch adds no group or
  banner: each row keeps its result and the header only counts them.
- **A card is one item.** A card that holds one thing (a failed push, a
  stopped rebase) keeps its title and puts the line under it. Its verbs sit
  in the `action` slot, visible at rest, since there is no row to hover. While
  the agent works the card offers Stop and Open transcript and drops every
  verb that would race it (Retry, a second start, the hint box). After Failed
  or Stopped the start verb reads Retry and is the only Retry on the card.
  The push fix line (`PushFixStatusLine`) is the reference.
- **The batch.** A batch puts its state on every item (Fixing, Queued with its
  place, Fix ready) and one quiet count in the list's header, with Stop all in
  its `⋯`. The tab that holds live work carries a breathing dot on every
  tab, its tooltip the word and the item ("Analyzing payments-api / test").
  Review comments do this: `commentWorkOf` gives each comment Fixing,
  or Queued with "2nd in this fix", and `FixRunCount` draws the count as one
  `ItemWorkLine` (Fixing · 2 of 3, with the time). One agent fixes the whole
  batch, so Stop on any of its rows stops all of it, behind a confirm and a
  tooltip that name the batch ("Stop the fix for 3 comments").
- **The place.** While you are on the tab, an item that changes state keeps
  its group and its place; the groups sort again when you come back to the
  tab. The list component holds the order, never the store. Failing checks
  and review comments do this (`useHeldCheckGroups`,
  `useHeldReviewGroups`).
- **The words.** Every word and verb comes from `ITEM_WORK_WORDS`
  (`itemWork/itemWorkWords.ts`): Starting, Queued, Analyzing, Fixing,
  Resolving, In a run, Cause found, Fix ready, Question, "Fixed, not pushed",
  "Applied, not pushed", Pushed, Fixed, No fix found, Stopped and Failed. Open
  transcript opens an agent's work and Open run opens a run. Failed is
  `role="alert"`, every other word `role="status"`. `?scene=u48-item-work-line`
  shows each word.
- **One word on every surface.** The rail's Needs you rows, the board and
  session marks, Ask, the fix run line in the transcript and the rebase panel
  read the same words. Counts come from one function
  (`resolveWordCountText`): "#318 · 2 fixes ready · 1 failed", never "to
  review" or "couldn't fix". The transcript line reads Fixing, Question and
  Fixed. A conflict the Lead resolves reads Resolving and offers Open
  transcript. Discard means one thing: it throws a proposed fix away, on the
  row and in the Fix comments drawer, and the comment is open again; parking
  a comment is Skip. The retired names guard holds Fix proposed, No fix
  proposed, Fix stopped, Re-running, Open the agent and "couldn't fix".

## Empty states

A page is always in one of five states, and each state has one shape. So "nothing
here" never reads five ways, loading never looks empty, and a failure is never
drawn as an empty list.

1. **Loading.** Never empty, never "Nothing yet" and never the word on screen.
   Keep the last known content, or draw a skeleton that copies the real
   layout: cards for a page of numbers (Impact, Budget), three `SkeletonRow`
   rows for a list. The words that say what loads live in the skeleton's
   accessible name, with `aria-busy`. No page draws a generic block of cards
   that does not match its own layout. A long wait (Storage measuring a folder)
   keeps the name of the row it measures visible. A part that reloads keeps its
   last known content.
2. **First time.** Something will be here, and nothing has made it yet.
   `EmptyState size="page"`: a bare 18px icon in `text-muted-foreground` (no
   circle, no fill, no border), a title that says what will be here, one
   sentence that says how it gets here, and one primary that starts it. The
   title reads "No" and the things, then "yet" ("No workflows yet"). A state
   that names a step carries that step as its button, or does not name it. A
   page with nothing the person can start (Questions) has no primary. Inside a
   section of a page, `EmptyState size="section"`: one line, no card and no
   padding block.
   A stage may hold its input. The empty chat is one stage centred both ways and
   lifted 24px above the optical centre: the bare glyph, the title, one
   sentence, the composer itself and up to three quiet suggestion rows. The
   first message docks the composer at the bottom.
3. **Nothing matches.** A filter or a search hides everything. `EmptyLine`
   with `Clear filter` (or `Clear search`), or the next place to look. It never
   uses the first-time shape: the list exists, the filter is the cause.
4. **Can't load.** `ErrorStrip`, an inline danger `Notice` with
   `role="alert"`: the title is always "Couldn't load" and what failed, the
   body gives the reason in words, then `Retry`, and `Details` with the raw
   text. One strip per view, never one per request: two failed reads of one
   page share a strip and a Retry ("Couldn't load pull requests and review
   throughput"). A permission problem uses `tone="warning"` and names the fix.
   A failure is never an empty state, and an empty state is never shown while
   a load failed.
5. **Not connected.** The tool behind the page is not connected. The
   `IntegrationConnectPanel` pattern for one tool, a `page` state with
   `Connect a tool` where several tools feed the page (Tasks).

### The primitives

`EmptyState` takes `size: 'page' | 'section'`. A `bordered` state with no size
maps to `page` without a border. The glyph
is muted, without a tinted circle. A `page` state sits at the top left of the
content column (18px glyph, title, one sentence, then its one action), never
centred in the pane; the empty chat stage (`ChatEmpty`) is the one centred
stage. A `page` state is an `h2` unless
`headingLevel` chooses another level; a `section` state has no heading.
`FilledEmptyState` is `EmptyState size="section"`; a new caller names the size
directly. A caller passes only layout or an inset, never a fill, border or circle.

An empty line inside a section ("No scripts match "tset".") is `EmptyLine`: one
faint sentence, an optional glyph before it and an optional action after it. It
is the only shape for a one-line empty, never bare text in its own style.
`hand-made-notices-and-empty-lines.test.ts` and
`inline-empty-states-use-the-wrappers.test.ts` count text that opens with `No `,
`Nothing` or `None` outside the wrappers, and their baselines only shrink.

### Page by state

A cell names the shape that page uses. N/A means the state cannot happen
there. The table is the contract: a page that does not draw its cell yet is a
defect to fix when the page is touched, and its test moves with it.

| Page           | Loading                               | First time                                                                                          | Nothing matches                                          | Can't load                                                          | Not connected                                      |
| -------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------- |
| Runs           | The run page draws goal, facts, steps | `page`: No runs yet, Run a workflow. `section`: No runs in progress                                 | N/A                                                      | N/A                                                                 | N/A                                                |
| Agents         | Skeleton rows                         | `page`: No agents yet, Start an agent. `section`: No active agents                                  | N/A                                                      | N/A                                                                 | N/A                                                |
| Artifacts      | Three skeleton rows                   | `page`: No artifacts yet, New artifact                                                              | `EmptyLine`: No plans in this session, Clear filter      | `ErrorStrip`: Couldn't load artifacts, Retry and Details            | N/A                                                |
| Scripts        | Three skeleton rows                   | `page`: No scripts yet, Add folder. `section`: No scripts in a project, Pin a script, New script    | `EmptyLine`: No scripts match, Clear filter              | `ErrorStrip`: Couldn't load the scripts of a project, Retry         | N/A                                                |
| Questions      | Skeleton rows                         | `page`: No questions yet, no primary                                                                | N/A                                                      | `ErrorStrip`: Couldn't load questions, Retry and Details            | N/A                                                |
| Activity       | Skeleton rows                         | `section`: No runs or agents yet, See Log only while the log has entries                            | `EmptyLine`: No log entries match, Clear search          | N/A                                                                 | N/A                                                |
| Notifications  | Skeleton rows                         | `section`: No notifications yet, one line and no Unread or All tabs                                 | `section`: You're caught up (Unread view)                | N/A                                                                 | N/A                                                |
| Tasks          | Skeleton rows                         | `page`: No items yet                                                                                | `EmptyLine`: No items match these filters, Clear filters | `Notice`, warning for a permission problem, Retry and Open settings | `page`: No tool connected, Connect a tool          |
| Board lanes    | Archived shows skeleton rows          | `section` inside each lane, the lane keeps its full height                                          | N/A                                                      | N/A                                                                 | N/A                                                |
| Checks         | Skeleton rows                         | `section`: No checks have reported yet                                                              | N/A                                                      | `Notice`, warning when the credential lacks access, Retry           | N/A                                                |
| Comments       | Skeleton rows                         | `section`: No comments yet                                                                          | `EmptyLine`: No comments match, Clear filter             | `ErrorStrip`: Couldn't load comments, Retry and Details             | N/A                                                |
| Commits        | Three skeleton rows                   | `section`: No commits yet on this branch. No project: Add a project to see its commits, Add project | N/A                                                      | `ErrorStrip`: Couldn't load commits, Retry and Details              | N/A                                                |
| Impact         | Skeleton cards                        | `page`: Impact fills in as sessions finish, spend line                                              | N/A                                                      | `ErrorStrip`: one strip for the page, Retry and Details             | N/A                                                |
| Chat           | Header, three messages and composer   | No rail and no empty page: the new chat, its message box reads Message an agent                     | `EmptyLine`: No chats match this filter, Clear filter    | `ErrorStrip`: Couldn't load chats, Retry and Details                | N/A                                                |
| Workflows      | Three skeleton rows                   | `page`: No workflows yet, Restore built-in workflows                                                | `EmptyLine`: No workflows match, Clear search            | `ErrorStrip`: Couldn't load workflows, Retry and Details            | N/A                                                |
| Monitoring     | Skeleton rows                         | `page`: No ports in use                                                                             | `EmptyLine`: No ports match, Clear search                | `ErrorStrip`: Couldn't load ports, Retry and Details                | N/A                                                |
| Terminal       | A status line, Starting the shell     | `page`: No terminal yet, New terminal                                                               | `EmptyLine` in the New terminal picker                   | `ErrorStrip`: Couldn't open the terminal, Retry and Details         | N/A                                                |
| Connections    | Skeleton rows                         | `page`: No providers connected, Connect a provider                                                  | `EmptyLine`: No tools match, Clear search                | `ErrorStrip`: Couldn't load connections, Retry and Details          | `IntegrationConnectPanel` on the page of each tool |
| Search         | Skeleton rows, the query stays        | N/A                                                                                                 | `EmptyLine`: No results, Clear search                    | `ErrorStrip`: Couldn't search, Retry and Details                    | N/A                                                |
| Palette        | `PaletteSkeleton`                     | N/A                                                                                                 | `EmptyLine`: No commands match                           | N/A                                                                 | N/A                                                |
| Settings lists | Skeleton rows                         | `section` that says when rows are added (No rules yet, No decisions yet)                            | `EmptyLine`: No settings match, Clear search             | `ErrorStrip` that names the list, Retry and Details                 | N/A                                                |

Inline empty states belong to a lens or a compact collection surface, and they
are `section` states. `inline-empty-states-use-the-wrappers.test.ts` fails on any
`size="inline"` under `apps/desktop/src`: name `section` or `page`.

**Loading keeps the page in place.** A part that reloads shows a skeleton of
its own height: `SkeletonRow` (a row, with a `status` label naming what loads)
or a `Skeleton` sized to the chip. Only the parts that reload turn to skeleton; the
title, the goal, the timeline and the cost stay.

**Bare beats the circle and the hero.** The pane already has a title and a
rhythm. A tinted circle, a border and a bigger title repeat the title and
pretend the page is a landing page, when it is one of a rail full of
destinations. The page state is a glyph, two lines and one action.

**The gap trap.** The parent flex container owns the spacing. So a child that
renders `<div />` or an empty fragment still costs a full gap step, and leaves
a hole nobody can trace. A component with nothing to show returns `null`. The
rail drops groups with no rows, instead of drawing a heading over nothing.

```tsx
if (count === 0) return null;
```

Groups are separated by the step the pane puts between its body children.
Rows inside one group sit tighter. That is what makes active, completed and
discarded read as three answers instead of one long list.

What "empty" means, and the copy rule for it, are product rules and live in
[DESIGN.md](../../../DESIGN.md).

## Question card

An open question is a decision to take, not a message to write, so it has one
card (`QuestionCard`, in `features/context/components/QuestionsTab`) in three
places: the Questions lens detail (`variant="full"`), the tail of the
transcript and the top of an agent's Brief (`variant="compact"`, a raised
`bg-elevated` card with a `border-soft` hairline). `LiveQuestionCard` wires it
to the drafts and the delegate controls; every place uses that one.

- **Top line.** The asking agent's avatar, "_Name_ asks", a warning `Chip`
  when it blocks, the age, then on the right "2 of 3" with dots and chevrons
  when the same agent asked more than one, and the dismiss `IconButton` for a
  question that does not block. No footer with pips or a recap.
- **Question.** The first line is the title (`text-title` full,
  `text-heading` compact), the rest is up to a few lines of context in
  `text-body` muted, and file paths quoted as code become `text-code` chips in
  the full card.
- **Options.** One tile per answer (`AnswerOptionRow`): the keyboard number in
  a `text-meta` key cap, the label in `text-row`, a primary `Chip`
  "Recommended" on the recommended one, and a radio or checkbox indicator on
  the right. A tile at rest is `bg-fill` plus `border-soft`; hover takes
  `border`; a picked tile takes `bg-selected`, never a primary tint. "Something
  else" is the last tile and opens its field in line (`CustomAnswerField`). A
  question with no options is one text field.
- **Delegation** is a secondary text action under the tiles
  (`DelegateAnswerRow`): "Let an agent decide", then the routing pill, hints
  and Cancel once chosen, and the tiles dim.
- **Actions** end the card through `FormActions` (`AnswerSubmitButton`): the
  key hint in `leading`, Skip as `ghost`, Answer (or Send to agent) as the one
  primary. `1` to `9` pick, Enter answers, Escape leaves a field.
- **Answered.** A staged answer keeps the picked tile and swaps the actions for
  a done line with Undo (`QuestionAnswerDone`); a sent one shows the answer in
  a `bg-fill` box.
