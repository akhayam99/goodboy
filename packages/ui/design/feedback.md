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

Every message shape in the desktop app renders through it. `ErrorStrip` is a
thin `Notice placement="banner"` for a failed load with Retry. Budget alerts
and the unpriced-turns warning are banners. Guide tips, the partial brief after a step,
the branch switch confirmation and merge conflicts are `inline`. So are three
failures that used to print one red line: the wireframe viewer ("Couldn't show
the pages", with Retry), the Scribe's pull request text ("Couldn't write the
pull request text", with Retry) and the first-lap publish steps, each with the
raw message behind Details. The publish panel's missing GitHub tool is an
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
  `isBusy` (`Button`, `GhostActionButton`, `InlineConfirm`) or `busy`
  (`IconButton`, `RefreshIconButton`): the pulsing glyph, `aria-busy`, and
  disabled against a second submit. Never a spinner, never a toast that
  says "started" when the control already says it.
- **Success is the new state.** The action refetches exactly the state it
  changed (the mount's request, the worktree status, the resolve rows), so
  the screen shows the result without a reload. A toast adds nothing when the
  result is on screen; it is only for a result that lands somewhere else, like
  an agent started with `focus: 'none'`.
- **Failure is one log row.** The error goes to `reportError` with a title
  that names the action ("Couldn't push the branch") and the real message as
  its body. The toast is its preview. The control comes back enabled, so the
  click is the retry. A form the user is still looking at keeps its error next
  to its footer instead, as DESIGN.md says. Never a toast, an inline banner and
  a suggestion for the same outcome.

`usePendingAction` (`apps/desktop/src/shared/hooks/usePendingAction`) is the
one runner: `run({ key, failureTitle, task })` keeps `key` in `pendingKeys`
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
A suggestion's `choices` (a rebase target, "Start tester instead") render as
ghost buttons beside the primary in `NextStepRow`, run through the same runner
under their own key, and hold the row's other controls while one runs.

## Empty states

A page is always in one of five states, and each state has one shape. So "nothing
here" never reads five ways, loading never looks empty, and a failure is never
drawn as an empty list.

1. **Loading.** Never empty and never "Nothing yet" while loading. Keep the
   last known content, or show the section's heading with a muted "Loading"
   line. Unread lists show three SkeletonRow rows with accessible loading names
   and aria-busy. A part that reloads keeps its last known content.
2. **First time.** Something will be here, and nothing has made it yet.
   `EmptyState size="page"`: a bare 18px icon in `text-muted-foreground` (no
   circle, no fill, no border), a title that says what will be here, one
   sentence that says how it gets here, and one primary that starts it. A page
   with nothing the person can start (Questions) has no primary. Inside a
   section of a page, `EmptyState size="section"`: one line, no card and no
   padding block.
   A stage may hold its input. The empty chat is one stage centred both ways and
   lifted 24px above the optical centre: the bare glyph, the title, one
   sentence, the composer itself and up to three quiet suggestion rows. The
   first message docks the composer at the bottom.
3. **Nothing matches.** A filter or a search hides everything. `EmptyLine`
   with `Clear filter` (or `Clear search`), or the next place to look. It never
   uses the first-time shape: the list exists, the filter is the cause.
4. **Can't load.** `Notice tone="danger" placement="inline" role="alert"`: a
   title that names what failed, the reason in words, the fix, `Retry`, and
   `Details` with the raw text. A permission problem uses `tone="warning"` and
   names the fix. A failure is never an empty state, and an empty state is
   never shown while a load failed.
5. **Not connected.** The tool behind the page is not connected. The
   `ConnectIntegrationEmptyState` pattern for one tool, a `page` state with
   `Connect a tool` where several tools feed the page (Tasks).

### The primitives

`EmptyState` takes `size: 'page' | 'section'`. Retired sizes are removed. A
`bordered` state with no size still maps to `page` without a border. The glyph
is muted, without a tinted circle. A `page` state sits at the top left of the
content column (18px glyph, title, one sentence, then its one action), never
centred in the pane; the empty chat stage (`ChatEmpty`) is the one centred
stage. A `page` state is an `h2` unless
`headingLevel` chooses another level; a `section` state has no heading.
`FilledEmptyState` remains a thin section wrapper only for host callers awaiting
integration. Owned callers name the section size directly. A caller passes only
layout or an inset, never a fill, border or circle.

An empty line inside a section ("No scripts match "tset".") is `EmptyLine`: one
faint sentence, an optional glyph before it and an optional action after it. It
is the only shape for a one-line empty, never bare text in its own style.
`hand-made-notices-and-empty-lines.test.ts` and
`inline-empty-states-use-the-wrappers.test.ts` count text that opens with `No `,
`Nothing` or `None` outside the wrappers, and their baselines only shrink.

### Page by state

A cell names the shape that page uses. N/A means the state cannot happen
there. `0.22.1` marks a page the sweep has not reached yet: it still shows its
old shape, and the next round moves it.

| Page           | Loading                                  | First time                                                                                       | Nothing matches                                          | Can't load                                                          | Not connected                             |
| -------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------- |
| Runs           | N/A (the session holds its runs)         | `page`: No runs yet, Run a workflow. `section`: No runs in progress                              | N/A                                                      | N/A                                                                 | N/A                                       |
| Agents         | Skeleton rows                            | `page`: No agents yet, Start an agent. `section`: No active agents                               | N/A                                                      | N/A                                                                 | N/A                                       |
| Artifacts      | Three skeleton rows                      | `page`: No artifacts yet, New artifact                                                           | `EmptyLine`: No plans in this session, Clear filter      | `Notice` danger: Could not load artifacts, Retry and Details        | N/A                                       |
| Scripts        | Muted line: Reading scripts in a project | `page`: No scripts yet, Add folder. `section`: No scripts in a project, Pin a script, New script | `EmptyLine`: No scripts match, Clear filter              | `Notice` danger: Couldn't read the scripts of a project, Retry      | N/A                                       |
| Questions      | Skeleton rows                            | `page`: No questions yet, no primary                                                             | N/A                                                      | 0.22.1                                                              | N/A                                       |
| Activity       | Skeleton rows                            | `section`: No runs or agents yet, See Log only while the log has entries                         | `EmptyLine`: No log entries match, Clear search          | N/A                                                                 | N/A                                       |
| Notifications  | Skeleton rows                            | `section`: No notifications yet, one line and no Unread or All tabs                              | `section`: You're caught up (Unread view)                | N/A                                                                 | N/A                                       |
| Tasks          | Skeleton rows                            | `page`: No items yet                                                                             | `EmptyLine`: No items match these filters, Clear filters | `Notice`, warning for a permission problem, Retry and Open settings | `page`: No tool connected, Connect a tool |
| Board lanes    | Archived shows a muted Loading line      | `section` inside each lane, the lane keeps its full height                                       | N/A                                                      | N/A                                                                 | N/A                                       |
| Checks         | A muted Loading line                     | `section`: No checks have reported yet                                                           | N/A                                                      | `Notice`, warning when the credential lacks access, Retry           | N/A                                       |
| Comments       | 0.22.1                                   | 0.22.1                                                                                           | 0.22.1                                                   | 0.22.1                                                              | 0.22.1                                    |
| Commits        | Three skeleton rows                      | `section`: No commits yet on this branch                                                         | N/A                                                      | `Notice` danger: Could not load commits, Retry and Details          | N/A                                       |
| Impact         | Skeleton cards                           | `page`: Impact fills in as sessions finish, spend line                                           | N/A                                                      | `Notice` danger: Retry and Details                                  | N/A                                       |
| Chat           | Three skeleton rows                      | `page`, no rail: No chats yet, Start a chat                                                      | `EmptyLine`: No chats match this filter, Clear filter    | `Notice` danger: Could not load chats, Retry and Details            | N/A                                       |
| Settings lists | 0.22.1                                   | 0.22.1                                                                                           | 0.22.1                                                   | 0.22.1                                                              | 0.22.1                                    |

The new session draft is the kickoff. It asks "How do you want to
start?" and answers with a single-select list of three rows, each a concept
glyph, a title and one line: Pick up a task, Run a workflow, Not sure yet. The
selected row reveals its fields and its one primary under the list. Arrow keys
move between rows and Enter moves into the selected row's fields. There is no
example run and no grid of tiles.

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
  key hint in `leading`, Skip as `ghost`, Answer (or Hand off) as the one
  primary. `1` to `9` pick, Enter answers, Escape leaves a field.
- **Answered.** A staged answer keeps the picked tile and swaps the actions for
  a done line with Undo (`QuestionAnswerDone`); a sent one shows the answer in
  a `bg-fill` box.
