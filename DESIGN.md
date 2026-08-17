# Goodboy: Design

> **Read this when** you're judging whether a screen or flow is right, against the three questions and the north star. **Not for** concrete tokens and primitives (`packages/ui/DESIGN-SYSTEM.md`), Tailwind mechanics (`docs/styling.md`), or nav structure (`docs/navigation.md`).

The intent layer: how Goodboy looks and reads. Rules, not suggestions: when a
screen feels off, it has broken one of them. The primitives, tokens and visual
vocabulary that carry these rules live in
[packages/ui/DESIGN-SYSTEM.md](./packages/ui/DESIGN-SYSTEM.md).

> **North star**: Cursor's calm. Linear's typographic discipline. Stripe's
> number-density. A whisper of Warp's command-surface. Goodboy is playful in
> its marketing and surgical inside the app. Never both at once.

## The three questions

Every work item answers **what do I see, what can I do to it, where does it
take me next**, or it is rejected. The non-coder read is first-class: a release
must not regress the path where a PM understands the same task without ever
seeing a raw diff.

## The editorial line

A professional developer tool: intentional, dense without being noisy, fast,
opinionated. Playfulness has a place (splash, onboarding, marketing site); the
working surface does not. One register per surface; the other supplies texture
only.

### Register taxonomy

Four registers share **one** primitive family and **one** tone vocabulary. They
differ only by density grade, layout, and which internals they expose:

- **Dashboard**: metric tiles. Glanceable rollups, no drill-in.
- **Board**: the stage board, the runs board, columns and lanes. Scan density,
  select-to-navigate.
- **Reading-surface**: chat transcript, plans, PR body. Comfortable density. A
  destination, reached from a card.
- **Devtool**: diff hunks, terminal, raw tool JSON. The deepest drill-in:
  monospace, never landed in by default.

Conversation reads as conversation; tool calls read as a devtool. Never let the
two collapse into the same texture.

## Voice & copy

- **Speak the domain language.** Agent, session, workspace, workflow, plan. No
  synonyms, no aliases.
- Product copy language is owned by
  [docs/tone-of-voice.md](./docs/tone-of-voice.md); repository language is
  owned by [CONVENTIONS.md](./CONVENTIONS.md).
- **Terse and direct.** Labels are nouns or verbs, not sentences. Help text
  earns its place or is cut. No exclamation marks, no cheerleading.
- **Sentence case** for buttons, headings, menu items. Never Title Case, never
  ALL CAPS except tiny eyebrow labels.
- **Say what a thing does, not how it feels.** "No plans yet" beats "Looks
  empty in here!".

## Density

Density is a graded token, one grade per register, never a per-surface guess.

**Chrome pays rent.** Above a session pane there is one chrome row and a
hairline, and nothing else: no workspace bar, no pane header band, no lens
toolbar. A band that only restates what the pane already says gets cut.

## Readability

**Every text in the app is written and set to be read.** Density is about
chrome and metadata, never prose. Same bar whether a human or a model wrote it.

- **Measure beats width.** Prose sits in 45 to 75 characters. A pane is not a
  measure: constrain the column, do not stretch the paragraph.
- **Structure is not decoration.** A body longer than a few lines carries
  headings, short paragraphs and lists mirroring what it says.
- **Prose is rendered, never dumped.** Source syntax (fences, heading hashes,
  HTML comments, marker tags) never reaches the screen as text, anywhere.
- **Rhythm follows the register.** Prose set at scanning density is a defect.
- **Generated text has a contract.** Anything a model writes for the user to
  read is instructed on shape and length in its prompt. An unbounded paragraph
  is a prompt bug, not a rendering problem.
- **Truncation is honest.** A clamp says there is more and offers a way to it.

The one exception is the artifact the user navigated to: a diff, a terminal, a
plan body, a stack trace. Shown whole. List below.

## Compaction: lists stay dense, artifacts don't

Six rules, phrased so a diff can be checked against them directly.

- **Prose clamps in lists.** Any prose inside a list, popover or card row goes
  through a line clamp (3 lines or fewer) or a collapsed disclosure. An
  unbounded markdown render or `whitespace-pre-wrap` is legal only in a pane or
  detail view whose title names that content.
- **Three tiers per list item**: a title, one status or chip row, one meta row.
  A fourth stacked block means the item needs a focused view.
- **Terminal state hides behind a count.** Completed, answered, resolved,
  dismissed and discarded items never render inline by default: a header toggle
  with a count, or a collapsed disclosure row.
- **One visible action per row**, plus the chevron. Everything else is revealed
  on hover and focus, or lives in the focused view.
- **Empty sections collapse.** A surface that is the whole body of what the
  user navigated to (a pane, or a wizard step) shows an `EmptyState`. A
  section inside a composite page shows its header at most, never a
  placeholder card.
- **No off-scale type.** The type scale lives in
  [packages/ui/DESIGN-SYSTEM.md](./packages/ui/DESIGN-SYSTEM.md).

### The exemption: never compress the artifact

None of the rules above are absolute; a rule with no stated exception gets
misapplied. The governing line: compress metadata, chrome and history without
limit; never compress the artifact the user navigated to.

The test is what the user came for, not which component renders it:

| what is exempt                              | why                                                   |
| ------------------------------------------- | ----------------------------------------------------- |
| a plan body                                 | the plan is the artifact the user opened              |
| a document pane (goal, decisions, summary)  | the pane's own title already names the content        |
| a pull request or merge request description | click-to-edit; a clamp fights the editor              |
| the text of a question being answered       | clamping the thing being decided causes wrong answers |
| a diff                                      | the diff is the artifact                              |
| terminal output                             | raw process output, not summarizable                  |
| a file preview                              | file contents, not metadata                           |
| a stack trace and its breadcrumbs           | the trace is the artifact under investigation         |
| a guide body                                | the guide is the artifact                             |

Bounded scroll regions on those are fine; truncation is not. A new surface
qualifies by answering the why column, not by being added to this list.

## Color & theme

- **Dark by default**, light fully supported. No system-preference state: the
  choice is explicit and persisted.
- Color comes from **semantic tokens**: `success`, `warning`, `danger`, `info`,
  `merged`, the elevation ramp, per-provider accents. A raw hex or `oklch` in a
  component is a bug (the xterm palette is the only quarantine).
- **The stage palette tracks the life of the work**, not its mood. Done borrows
  the merged purple on purpose: a finished session is almost always a merged
  pull request, and one outcome must not read as two colors.

## Status & signals

- **The element is the signal.** A running session shows a moving border, not a
  spinner parked beside it.
- **One signal hierarchy.** Toasts and inline nudges are _previews_; the
  notification inbox is the _log_. Nothing lives only in a toast.
- **Errors are toasts, never pinned banners.** No inline banner that lingers
  after its cause is gone. One exception, which also carves out the
  budget-alert rule: the composer's pre-send routing line, live state on an
  unsent turn rather than an alert, clearing the moment routing changes.
- **Chips carry a word.** Icon-only only where space is truly gone, and then
  the label survives as a tooltip.
- **Empty means no active item.** A lens with nothing running keeps its empty
  state even once a completed group is revealed under it, and its primary
  action moves to the header only when there is live work. The copy matches:
  an empty state above a visible list says "No active agents", never "No agents
  yet".
- **Control markers render, never leak.** Tool calls, clusters and plans
  surface as structured cards and chips from one shared accent mapping. A raw
  marker never reaches the transcript.
- **Subagents render through one tree.** Curated graph on top, outcome words
  with a moving border in the middle, internals behind disclosure at the
  bottom. Orchestration is a runs board, not a transcript to scroll.

## Spend

Cost is never more than a glance away: the cost badge belongs anywhere a unit
of work is shown. Numbers are always `tabular-nums`. Money shows intent: a live
estimate before sending, a running total after. The workspace rollup lives in
the always-visible top bar, so health reads without entering a session; a
second route to the budget studio is fine, a second home for the number is not,
and hiding it behind a popover breaks the rule above. A budget cap is edited on
the surface that displays it. Budget alerts follow the exception-bearing rule
in Status & signals.

## Components & interaction

- **Tabs when you return, accordion when you'd forget.** Studio detail panels
  are tabs.
- **Read inline, edit on a focused surface.** The transcript is for reading.
- **One creation grammar, one card action grammar.** Both are single: a second
  shape for either is a defect, not a variant. A stepper needs information that
  genuinely does not fit one screen: only the workflow builder and the
  first-run wizard have one.
- **Empty states teach the board model.** What the thing is, why it matters,
  one action to create it. Teach the board, not the chat. Never a dead end,
  never a "start chatting" prompt.
- **A card in a collection keeps that grammar; the sole occupant of a pane gets
  a header toolbar.** Rendered alone, a record is a pane, not a card, and its
  lifecycle and destructive actions move up beside the title.
- **One status owner per card.** With a state strip, the strip owns the live
  sentence, the title pill drops back to the run outcome, the meta line repeats
  neither.
- **Automation owns its advance.** With a hands-free mode on, manual advance
  controls do not render: offering the click automation is about to make
  teaches that the mode does not work. Exception: where automation stopped for
  good and says why, the recovery control stays. Precedent: GitHub Actions
  offers only approval gates and re-run mid-run.

## Motion

- All motion is `motion-safe:` gated and respects `prefers-reduced-motion`.
- Motion **confirms** (a value rolled, a panel slid, a turn started); it never
  decorates.
- **Motion names who is working, and for how long.** Generating right now
  (seconds): moving border plus pulsing dot. Idle by design while something
  else runs (minutes to hours): static, alive by information instead, naming
  the step it waits on and ticking an elapsed counter. Waiting on the user: no
  motion at all, `warning` tone, an explicit ask, because motion signals
  machine agency and animating "waiting for you" assigns the work to the wrong
  party. A surface that shimmers for hours teaches that its motion means
  nothing.
- **One animation, one meaning.** The registry is closed; adding to it is a
  design-system change, not a feature decision.
- **Loading is a skeleton; running is a moving border. Spinners are forbidden.**
  No `Loader2`, no hand-built dot loaders in `packages/ui`;
  `no-loader2-in-ui-package.test.ts` enforces that boundary in CI. The skeleton
  mirrors the real layout and is part of the component: change the layout,
  update the skeleton in the same change.

## Accessibility

- Every icon-only button has an `aria-label`. Every interactive element is
  keyboard-reachable with a visible `focus-visible` ring.
- Color is never the only carrier of meaning: pair it with an icon, a word, or
  a shape.

Every pixel is intentional: if it carries no meaning, cut it.
