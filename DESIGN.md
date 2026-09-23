# Goodboy: Design

> **Read this when** you're judging whether a screen or flow is right, against the three questions and the north star. **Not for** concrete tokens and primitives (`packages/ui/DESIGN-SYSTEM.md`), Tailwind mechanics (`docs/styling.md`), or nav structure (`docs/navigation.md`).

This file says how Goodboy should look and read. These are rules, not
suggestions. When a screen feels off, it has broken one of them. The
primitives, tokens and visual building blocks that carry these rules live in
[packages/ui/DESIGN-SYSTEM.md](./packages/ui/DESIGN-SYSTEM.md).

> **North star**: Cursor's calm. Linear's typographic discipline. Stripe's
> number-density. A whisper of Warp's command-surface. Goodboy is playful in
> its marketing and surgical inside the app. Never both at once.

## The three questions

Every work item must answer **what do I see, what can I do to it, where does it
take me next**. If it does not, it is rejected. The non-coder view matters as
much as the coder view. A release must not break the path where a PM
understands the same task without ever seeing a raw diff.

## The editorial line

Goodboy is a professional developer tool. It is intentional, fast and
opinionated, and dense without being noisy. Playfulness has a place: the
splash, onboarding and the marketing site. The working screens are not playful.
Each surface has one register (one tone of voice and look). The other register
only adds texture.

### Register taxonomy

There are four registers. They share **one** primitive family and **one** tone
vocabulary. They differ only in density grade, layout, and which internals they
show:

- **Dashboard**: metric tiles. Totals you read at a glance, no drill-in.
- **Board**: the stage board, the runs board, columns and lanes. Built for
  scanning. You select a card to navigate.
- **Reading-surface**: chat transcript, plans, PR body. Comfortable density.
  It is a destination you reach from a card.
- **Devtool**: diff hunks, terminal, raw tool JSON. The deepest drill-in. It
  is monospace, and you never land in it by default.

Conversation reads as conversation. Tool calls read as a devtool. Never let the
two share the same look.

## Voice & copy

- **Speak the domain language.** Agent, session, workspace, workflow, plan. No
  synonyms, no aliases.
- [docs/tone-of-voice.md](./docs/tone-of-voice.md) owns the language of
  product copy. [CONVENTIONS.md](./CONVENTIONS.md) owns the language of the
  repository.
- **Terse and direct.** Labels are nouns or verbs, not sentences. Help text
  must earn its place, or it is cut. No exclamation marks, no cheerleading.
- **Sentence case** for buttons, headings, menu items. Never Title Case, never
  ALL CAPS except tiny eyebrow labels.
- **Say what a thing does, not how it feels.** "No plans yet" beats "Looks
  empty in here!".

## Density

Density is a graded token. Each register gets one grade. Never guess it per
surface.

**Chrome pays rent.** Chrome is the frame around the content: bars, headers,
toolbars. Above a session pane there is one chrome row and a hairline, and
nothing else. No workspace bar, no pane header band, no lens toolbar. If a band
only repeats what the pane already says, cut it.

## Readability

**Every text in the app is written and set to be read.** Density applies to
chrome and metadata, never to prose. The bar is the same whether a human or a
model wrote the text.

- **Measure beats width.** Measure is the line length. Prose sits in 45 to 75
  characters. A pane is not a measure. Limit the column width, do not stretch
  the paragraph.
- **Structure is not decoration.** A body longer than a few lines has
  headings, short paragraphs and lists that follow what it says.
- **Prose is rendered, never dumped.** Source syntax (fences, heading hashes,
  HTML comments, marker tags) never shows up on screen as text, anywhere.
- **Rhythm follows the register.** Prose set at scanning density is a defect.
- **Generated text has a contract.** When a model writes something for the
  user to read, its prompt tells it the shape and length. An unbounded
  paragraph is a prompt bug, not a rendering problem.
- **Truncation is honest.** A clamp says there is more, and offers a way to
  see it.

The one exception is the artifact the user opened on purpose: a diff, a
terminal, a plan body, a stack trace. It is shown whole. The full list is
below.

## Compaction: lists stay dense, artifacts don't

Six rules, written so you can check a diff against them directly.

- **Prose clamps in lists.** Any prose inside a list, popover or card row goes
  through a line clamp (3 lines or fewer) or a collapsed disclosure. An
  unbounded markdown render or `whitespace-pre-wrap` is allowed only in a pane
  or detail view whose title names that content.
- **Three tiers per list item**: a title, one status or chip row, one meta row.
  If an item needs a fourth stacked block, it needs a focused view.
- **Terminal state hides behind a count.** Items that are completed, answered,
  resolved, dismissed or discarded never show inline by default. Use a header
  toggle with a count, or a collapsed disclosure row.
- **One visible action per row**, plus the chevron. Every other action shows
  on hover and focus, or lives in the focused view.
- **Empty sections collapse.** When a surface is the whole body of where the
  user navigated (a pane, or a wizard step), it shows an `EmptyState`. A
  section inside a composite page shows its header at most, never a
  placeholder card.
- **No off-scale type.** The type scale lives in
  [packages/ui/DESIGN-SYSTEM.md](./packages/ui/DESIGN-SYSTEM.md).

### The exemption: never compress the artifact

None of the rules above are absolute. A rule with no stated exception gets
applied in the wrong place. The main line is this: compress metadata, chrome
and history without limit, but never compress the artifact the user navigated
to.

The test is what the user came for, not which component draws it:

| what is exempt                              | why                                                   |
| ------------------------------------------- | ----------------------------------------------------- |
| a plan body                                 | the plan is the artifact the user opened              |
| a document pane (goal, decisions, summary)  | the pane's own title already names the content        |
| a pull request or merge request description | click-to-edit, a clamp fights the editor              |
| the text of a question being answered       | clamping the thing being decided causes wrong answers |
| a diff                                      | the diff is the artifact                              |
| terminal output                             | raw process output, not summarizable                  |
| a file preview                              | file contents, not metadata                           |
| a stack trace and its breadcrumbs           | the trace is the artifact under investigation         |
| a guide body                                | the guide is the artifact                             |

A scroll region with a fixed height is fine on these. Truncation is not. A new
surface qualifies by answering the "why" column, not by being added to this
list.

## The contract of an action

Eight rules. Each one exists because a shipped defect broke it. They cover what
a surface promises and what it then does. A screen that reads well but lies
about its effect is a worse defect than one that reads badly.

- **Show the destination beside anything that writes.** When a surface sends a
  turn, runs a command or edits a file, it names where it will write. The
  destination is worked out at send time, not at render time. That means the
  project, plus its worktree and branch when they exist. When they do not, it
  is the real path: a folder project with no branch, or the scratch folder of
  a session with no project yet. When the whole session shares the
  destination, changing it says so. A control that moves the destination as a
  side effect of looking at something (opening a terminal, a popover or a
  diff) is a defect.
- **One term per concept, one canonical home per object.** A concept keeps a
  single name in chat, board, sidebar and docs. An object has one surface that
  manages it. Every other surface links there instead of growing a second set
  of actions. Two surfaces with different powers over the same object are a
  defect, not a convenience.
- **The user's name survives.** A link, an import or a heuristic never
  overwrites a title the user typed. Automatic naming proposes and waits. It
  does not apply the name and then tell the user.
- **Every state carries its object and its reason.** A status word alone is not
  a state. Tell apart unknown from clean, local from published, closed from
  merged, stopped from failed. Unknown is never drawn as the good case. If a
  state is worked out in more than one place, the copies will disagree one
  day. Work it out once and pass it along, and make the field impossible to
  leave out.
- **Teach the shortcut where the control is.** A key chord belongs in the
  control's own tooltip or menu row, not only in a settings page. Advertise
  only what the user can really reach. If a flag turns off a prefix, command or
  destination, remove it from the placeholder and the palette too, not only
  from the handler.
- **Start, then activity, then outcome.** Show that the work began, name the
  phase while it runs, and end on a result. Show only phases you can observe.
  No invented percentages, no made-up estimates. A failure keeps the input,
  states the cause, puts the technical detail behind a disclosure, and leaves a
  way to retry.
- **Reversible acts immediately, definitive asks first.** Archiving and
  similar actions happen at once, with an undo. Anything that destroys data for
  good, or that acts on a remote provider, asks for confirmation inline. It
  states exactly what is lost or sent, including what stays on disk. The same
  action behaves the same way from every entry point.
- **Durable changes land in the timeline.** A change of destination, an archive
  or restore, a discard, an answer, a publication outcome: each one is recorded
  and linked to the object it concerns. Transcript traffic is not. A fact does
  not arrive twice saying two different things.

## Color & theme

- **Dark by default**, light fully supported. No system-preference state. The
  user picks the theme, and the choice is saved.
- Color comes from **semantic tokens**: `success`, `warning`, `danger`, `info`,
  `merged`, the elevation ramp, per-provider accents. A raw hex or `oklch` in a
  component is a bug. The xterm palette is the only place where raw colors are
  allowed.
- **The stage palette tracks the life of the work**, not its mood. Done uses
  the merged purple on purpose. A finished session is almost always a merged
  pull request, and one outcome must not show in two colors.
- **A card says what it is with a rail, never with a fill.** The kind of an
  element lives in its left border and its icon: warning for a question,
  info for a file, danger for a failure. The surface behind it stays the app
  background. A column of cards reads as one dark page with a colored edge on
  each row, not a stack of tinted blocks. Three things still get a fill: the
  neutral elevation ramp (`bg-elevated` panels and insets), a choice the user
  made (the picked answer), and a badge or pill small enough to read as a
  label.

## Status & signals

- **The element is the signal.** A running session shows a moving border, not a
  spinner placed beside it.
- **One signal hierarchy.** Toasts and inline nudges are _previews_. The
  notification inbox is the _log_. Nothing lives only in a toast.
- **Errors are toasts, never pinned banners.** No inline banner stays on
  screen after its cause is gone. There is one exception, and it is also the
  exception to the budget-alert rule: the composer's pre-send routing line. It
  is live state on an unsent turn, not an alert, and it clears the moment
  routing changes.
- **Chips carry a word.** Use icon-only chips only where there is truly no
  space, and then keep the label as a tooltip.
- **Empty means no active item.** A lens with nothing running keeps its empty
  state, even after a completed group is shown under it. Its primary action
  moves to the header only when there is live work. The copy matches: an empty
  state above a visible list says "No active agents", never "No agents
  yet".
- **Control markers render, never leak.** Tool calls, clusters and plans show
  up as structured cards and chips, all from one shared accent mapping. A raw
  marker never reaches the transcript.
- **Subagents render through one tree.** A curated graph on top. Outcome words
  with a moving border in the middle. Internals behind a disclosure at the
  bottom. Orchestration is a runs board, not a transcript to scroll.

## Spend

Cost is never more than a glance away. The cost badge belongs anywhere a unit
of work is shown. Numbers are always `tabular-nums`. Money shows intent: a live
estimate before sending, a running total after. The workspace total lives in
the top bar, which is always visible, so you can see health without opening a
session. A second route to spend, in the impact studio, is fine. A second home
for the number is not, and hiding it behind a popover breaks the rule above. A
budget cap is edited on the surface that shows it. Budget alerts follow the
rule with the exception in Status & signals.

## Components & interaction

### Action zones

Actions sit with the object they affect, and stay visible while its content scrolls.

- The context row is the fixed breadcrumb or object-title row. Generic object actions such as open folder, archive, restore and delete sit at its far end. Lifecycle actions such as mark done and reopen sit there too, because they change the object, not the current section. Destructive actions use the same zone and open `InlineConfirm` beside the button that triggered them.
- The primary action for the focused object sits in the fixed detail header. It is the action that moves the object forward. A creation or edit flow is different: it commits through its single fixed footer primary action, with cancel and errors in that same footer.
- Section actions affect only one section and use `SectionHeader`'s action slot. Row and card actions follow the card action grammar.

An action row must not scroll away with the content. Generic object actions do not belong at the bottom of a transcript, a detail body or a long form. A footer is not a second home for object actions.

- **Tabs when you return, accordion when you'd forget.** Studio detail panels
  are tabs.
- **Read inline, edit on a focused surface.** The transcript is for reading.
- **One creation grammar, one card action grammar.** There is only one of
  each. A second shape for either is a defect, not a variant. A stepper is
  only for information that truly does not fit one screen. Only the workflow
  builder and the first-run wizard have one.
- **Empty states teach the board model.** They say what the thing is, why it
  matters, and offer one action to create it. Teach the board, not the chat.
  Never a dead end, never a "start chatting" prompt.
- **A card in a collection keeps that grammar. The sole occupant of a pane gets
  a header toolbar.** When a record is shown alone, it is a pane, not a card.
  Its lifecycle and destructive actions move up beside the title.
- **One status owner per card.** When a card has a state strip, the strip owns
  the live sentence. The title pill goes back to showing the run outcome, and
  the meta line repeats neither.
- **Automation owns its advance.** When a hands-free mode is on, manual advance
  controls do not render. Offering a click that automation is about to make
  teaches the user that the mode does not work. Exception: when automation has
  stopped for good and says why, the recovery control stays. Precedent: GitHub
  Actions offers only approval gates and re-run while a run is in progress.

## Motion

- All motion is `motion-safe:` gated and respects `prefers-reduced-motion`.
- Motion **confirms** (a value rolled, a panel slid, a turn started). It never
  decorates.
- **Motion names who is working, and for how long.** There are three cases.
  Generating right now (seconds): moving border plus pulsing dot. Idle on
  purpose while something else runs (minutes to hours): no motion. It stays
  alive through information instead: it names the step it waits on and ticks
  an elapsed counter. Waiting on the user: no motion at all, `warning` tone,
  and a clear ask. Motion means the machine is working, so animating "waiting
  for you" puts the work on the wrong party. A surface that shimmers for hours
  teaches that its motion means nothing.
- **One animation, one meaning.** The list of animations is closed. Adding one
  is a design-system change, not a feature decision.
- **Loading is a skeleton. Running is a moving border. Spinners are forbidden.**
  No `Loader2`, no hand-built dot loaders in `packages/ui`.
  `no-loader2-in-ui-package.test.ts` enforces that boundary in CI. The skeleton
  copies the real layout and is part of the component. If you change the
  layout, update the skeleton in the same change.

## Accessibility

- Every icon-only button has an `aria-label`. You can reach every interactive
  element with the keyboard, and it shows a visible `focus-visible` ring.
- Color is never the only carrier of meaning. Pair it with an icon, a word, or
  a shape.

Every pixel is intentional: if it carries no meaning, cut it.
