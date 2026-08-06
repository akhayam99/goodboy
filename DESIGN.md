# Goodboy: Design

How Goodboy looks, reads, and feels. `CONVENTIONS.md` governs the code; this
governs the surface. These are rules, not suggestions: when a screen feels
off, it has broken one of them.

> **North star**: Cursor's calm. Linear's typographic discipline. Stripe's
> number-density. A whisper of Warp's command-surface. Goodboy is playful in
> its marketing and surgical inside the app. Never both at once.

## The editorial line

Goodboy is a professional developer tool and should read as one: intentional,
dense without being noisy, fast, opinionated.

Playfulness has a place: the splash screen, onboarding, the marketing site.
The working surface does not: inside the app, copy and UI stay plain and
functional. One register per surface; let the other supply only texture.

## Voice & copy

- **Speak the domain language.** Agent, session, workspace, workflow, plan.
  The interface uses these words consistently and doesn't coin synonyms or
  aliases for them.
- **English only.** Code, copy, commits, docs.
- **Terse and direct.** Labels are nouns or verbs, not sentences. Help text
  earns its place or is cut. No exclamation marks, no cheerleading.
- **Sentence case** for buttons, headings, and menu items. Never Title Case,
  never ALL CAPS except tiny eyebrow labels.
- **Say what a thing does, not how it feels.** "No plans yet" beats "Looks
  empty in here!".

## Layout & navigation

- **App chrome**: a single top bar (`AppTopBar`), one 36px row closed by a
  hairline, holds context on the left (mascot, the sessions-column control,
  workspace identity, the session breadcrumb) and state plus global controls on
  the right (cost rollup, running scripts, notifications, theme, onboarding,
  settings). Theme is the one set-once preference exposed there, next to
  notifications, because it is reached often enough to earn the rent; the
  guide and pair-device stay out and live in the app settings studio and the
  command palette. A persistent footer
  (`AppFooter`) holds integration tools on the left and studio
  launchers (workflows, providers, budget, impact) on the right. The
  integrations are grouped by what they do, one `<Divider>` between groups: code
  hosts (GitHub, GitLab, Bitbucket), trackers (Linear, Jira, Sentry),
  conversation tools (Slack). A group renders its connected members as
  glyph-only buttons and closes with one add control that opens the whole
  category, connected or not, and every row in it opens that integration's
  studio, which carries the connect form when the workspace has not connected it
  yet. Every shipped integration belongs to exactly one group: that group is
  where a workspace connects it, so an integration in no group is unreachable.
  The top bar is context, never content: every control in it opens
  something elsewhere, none of them edits a record in place. See
  [docs/design.md](docs/design.md) for what each surface is made of and
  [docs/navigation.md](docs/navigation.md) for the full IA and breadcrumb
  derivation rules.
- **The session title is the breadcrumb.** Inside a session the top bar carries
  the stage dot, the session goal as the root crumb, and the lens trail behind
  it. The root is read-only: clicking it returns to the overview, it never
  opens an edit field. Rename lives once, on the overview header. No second
  in-content trail is drawn under it, and "Back to board" stays the sidebar's
  one primary action.
- **Workspace identity has one mount.** The workspace name lives in the top
  bar and nowhere else, because it must be readable on the board, where there
  is no sessions column at all. Clicking it opens an anchored popover that
  switches workspace and creates one; ⌘O and the palette open that same
  popover instead of building a second one. Workspace settings has its own
  control on the same row, next to the identity button, because a common
  per-workspace preference (verbosity, for one) buried inside the switcher
  popover was easy to never discover.
- **Shell layout**: top bar (always visible) · left sidebar (sessions and
  agents; hidden at Overview, revealed on session entry) · main (workspace
  board, or a session's lens rail plus pane) · footer (always visible). Each
  pane owns one job. There is no right pane: session detail is the pane itself,
  and artifacts (plans, diff, terminal) are lenses in the rail. The sidebar is
  session-scoped: at Overview only the board renders, with no left panel
  alongside it.
- **The board is home; chat is a destination.** With a workspace open and no
  session selected, the main pane is a cross-session stage board (needs you /
  running / in review / building / done), not chat. Selecting a card navigates
  into the session, resting on its overview pane. Chat, diff, terminal, and
  open-in-IDE are destinations reached from cards, never the landing surface.
  Every capability stays one navigation away; zero capability is lost.
- **Top bar is chrome, footer is access, sidebar is presence, palette is
  transit.** The top bar answers "where am I and what is it costing" (identity,
  crumbs, cost, notifications, theme, settings). The footer holds integration
  shortcuts and studio launchers. The sidebar answers "what else is going on"
  (session list, agents). The command palette (⌘K) answers "where do I want to
  be". Each has one job; they must not compete.
- **Navigation chrome is neutral at rest.** Footer launchers and session lens
  rows stay muted until selected, and the selected one takes a muted fill
  (`bg-muted text-foreground`) rather than a full inversion: only the settings
  toggle in the top bar still inverts. The lens rail keeps `aria-current` on
  the selected row. One deliberate exception: "Back to board" is tinted
  `primary`, the single action in the sidebar that leaves the session.
- **Pin the structure, flex the density.** A control's position is fixed so it
  can be learned, and no control appears or disappears at a count threshold.
  Counts themselves may: the attention and running chips render only above
  zero, because a chip reading zero is noise, not structure. Overview
  stays board-only. Inside a session, the sessions column is hidden or shown
  from one control in the top bar, or with ⌘B, and that choice persists. The
  sidebar has no collapse rail: a rail is a second, narrower copy of the
  column, and peek already serves the case it was for.
- **A shortcut is taught where it is used.** Bindings live in one registry
  (`shared/keyboard/registry.ts`) on three modifier planes: bare ⌘ for the app,
  ⌘⇧ for the session, ⌘⌥ for the lens rail. A control that has a binding shows
  it, because a shortcut nobody sees is a shortcut nobody learns. Dense rows
  reveal a pill on hover in the badge's place; tooltips and titles carry the
  glyph in parentheses. The hint never earns its place by truncating the label
  beside it: where the row is too tight, the tooltip is the mount.
- **Hidden is not gone: the column peeks.** With the sessions column collapsed,
  pointing at the window edge or resting on the top bar's control slides the
  same sidebar back over main, and it withdraws on its own when the pointer
  leaves. Peek floats the one sidebar rather than laying it out, so nothing
  needs a second, thinner variant of it. Navigating from a peeked panel closes
  it; only the control changes what is pinned.
- **Settings match the scope they edit.** Configuration splits into two
  surfaces by ownership: application settings is a full-page studio; workspace
  settings is a lightweight scoped pane. Each surface edits only
  what belongs to its scope. Changes save instantly: no Save/Cancel footer, no
  stacking one settings surface on another. The scope of a setting matches the
  scope of the surface it's edited on.
- **One overlay slot.** Workspace-scoped editors (new session, workspace
  settings) share a single overlay over the main pane, so the sessions column
  stays visible. Only one occupies it at a time, by strict precedence; they
  never stack as competing dialogs. Scope decides the pattern: session-scoped
  editors (the workflow builder, the PR studio) layer over the session pane
  instead, app-level studios are full-page, and what became a lens stays a lens
  (plans, diff). Confirmations are none of the above: an anchored popover is
  the default and `InlineConfirm` is the destructive case, with `Dialog` left
  to the three jobs an anchor cannot do. See
  [docs/styling.md](docs/styling.md).

### Register taxonomy

Four registers share **one** primitive family (Chip, StatCard, StatusDot,
Eyebrow, Divider, ScrollFade) and **one** tone vocabulary. They differ only by
density grade, layout, and which internals they expose:

- **Dashboard**: metric tiles. Glanceable rollups, no drill-in.
- **Board**: the stage board, the runs board, columns and lanes. Scan density,
  select-to-navigate.
- **Reading-surface**: chat transcript, plans, PR body. Comfortable density. A
  destination, reached from a card.
- **Devtool**: diff hunks, terminal, raw tool JSON. The deepest drill-in:
  monospace, never landed in by default.

## Density

Four named grades, driven by tokens
(`--density-{compact,cozy,comfortable,scan}`):

- **Compact**: the sidebar. Maximum information, minimum chrome.
- **Cozy**: the strips inside a pane, the composer, tool/system transcript
  rows.
- **Comfortable**: human and assistant prose in the transcript. Built for
  reading, not scanning.
- **Scan**: the stage board and other card grids. Tuned for sweeping a column
  of cards at a glance, not reading one.

Conversation reads as conversation; tool calls read as a devtool. Never let
the two collapse into the same texture.

**Chrome pays rent.** Above a session pane there is one 36px row and a
hairline: no workspace bar, no pane header band, no lens toolbar. A band that
only restates what the pane already says gets cut, so the work starts at the
top of the window.

## Readability

**Every text in the app is written and set to be read.** Density is about
chrome and metadata, never about prose. A screen that holds words the user has
to understand owes them a readable setting, and the same bar applies whether a
human or a model wrote them.

- **Measure beats width.** Prose sits in a column of roughly 45 to 75
  characters. A pane is not a measure: text that runs the full width of a wide
  window is unreadable no matter how good the words are. Constrain the column,
  do not stretch the paragraph.
- **Structure is not decoration.** A body longer than a few lines carries
  headings, short paragraphs and lists that mirror the shape of what it says.
  A wall of bold labels followed by run-on clauses is boilerplate, not
  structure.
- **Prose is rendered, never dumped.** Markdown is rendered as markdown.
  Source syntax (fences, heading hashes, HTML comments, marker tags) never
  reaches the screen as text, in a card, a preview, a panel or a transcript.
- **Line height and rhythm follow the register.** Reading text gets the
  comfortable grade and relaxed leading; scanning text gets compact. Prose set
  at scanning density is a defect.
- **Generated text has a contract.** Anything a model writes for the user to
  read (session summaries, decisions, resolver replies, plans) is instructed on
  shape and length in its prompt, not left to chance. An unbounded paragraph is
  a prompt bug, not a rendering problem.
- **Truncation is honest.** A clamp always says there is more and always offers
  a way to it. Silent cutting hides information the user was told they had.

The one exception is the artifact the user navigated to: a diff, a terminal, a
plan body, a stack trace. Those are shown whole. See `docs/styling.md` →
Compaction for the full exemption list.

## Color & theme

- **Dark by default** (developer-tool convention), light fully supported and
  switched from app settings or the command palette. There is no
  system-preference state: the choice is explicit and persisted.
- Color comes from **semantic tokens**: `success`, `warning`, `danger`,
  `info`, `merged`, the surface-elevation ramp, per-provider accents. A raw hex
  or `oklch` in a component is a bug (the xterm terminal palette is the only
  quarantine).
- **One tint helper, one stage map.** Semantic tones resolve through a single
  shared `tintClasses(tone)`; stage colors resolve through a single
  `STAGE_TONE` map. No per-file tone maps: a kind of tone reads the same
  everywhere because it has exactly one source.
- **The stage palette tracks the life of the work**, not its mood: attention is
  `warning`, running is `info`, in review is `success`, done is `merged`,
  building is neutral because nothing is asked of anyone yet. Done borrows the
  merged purple on purpose: a finished session is almost always a merged pull
  request, and the two should not be two different colors for one outcome.
- Elevation is a four-step ramp: canvas < panel < rail/chip < floating. Lift a
  surface by stepping the ramp, not by inventing a shade.

## Status & signals

- **The element is the signal.** A running session shows a moving border, not
  a separate spinner parked beside it. State is expressed through the surface.
- **One signal hierarchy.** Toasts and inline nudges are _previews_; the
  notification inbox is the _log_. Anything worth signalling reaches the
  inbox; nothing lives only in a toast.
- **Errors are toasts, never pinned banners.** An error surfaces as a
  transient, dismissible toast owned by the notification system, not an inline
  banner wired into the view that lingers after the cause is gone.
- **Chips carry a word.** Status chips (PR state, CI, agent kind) pair an
  icon with a label. Icon-only is allowed only where space is truly gone, and
  then the label survives as a tooltip.
- **A column holds its width.** A chip repeated down a list takes a fixed
  width, so short and long labels start at the same edge; and in a
  right-aligned cluster the variable text comes first with the glyphs last, so
  provider marks and status icons form a column instead of wandering row to
  row. See [docs/design.md](docs/design.md) for the widths and the call sites.
- **Empty means no active item.** A lens with nothing running keeps its empty
  state even once a completed group is revealed underneath it, and its primary
  action moves into the header only when there is live work.
- **Control markers render, never leak.** In-band control signals (tool calls,
  clusters, plans) surface as structured cards and chips drawn from one shared
  accent mapping, so a kind of signal reads the same wherever it appears. A raw
  marker never reaches the transcript.
- **Subagents render through one tree, at three densities.** An agent's
  subagents (implementation clusters, scout fan-out, resolvers, parallel work)
  all draw through one shared tree primitive: a curated graph at the top,
  outcome words with a moving border in the middle, internals behind disclosure
  at the bottom. Orchestration is a builder destination (a runs board), not a
  transcript to scroll.

## Spend

Cost is never more than a glance away. The cost badge belongs anywhere a unit
of work is shown: session rows, agent rows, the transcript turn, the input
footer. Numbers are always `tabular-nums`. Money shows intent: a live estimate
before sending, a running total after.

- **The rollup lives in the top bar.** A glanceable workspace rollup
  (attention count, which opens the needs-you list; running count; today's
  spend, which opens the budget studio; all `tabular-nums`) sits in the
  always-visible top bar, so workspace health reads without entering a
  session.
- **Caps are authored where they are shown.** A budget cap is edited on the
  same surface that displays it; you don't hunt for a separate settings screen
  to change a number you're looking at. Budget alerts are toasts, never pinned
  banners.

## Components & interaction

- **Tabs when you return, accordion when you'd forget.** Tabs reward "I came
  back to find this"; accordions reward discovery. Studio detail panels are
  tabs (`StudioDetailTabs`).
- **Read inline, edit on a focused surface.** Plans and PR bodies render in
  place; editing opens a focused surface (an overlay pane or its own lens). The
  transcript is for reading.
- **One creation grammar.** Every surface that creates something (new session,
  launch from an issue, open a pull request, the workflow builder) lays out the
  same way, and the next one follows it rather than inventing its own. The form
  is bare sections stacked in one column, never a bordered box wrapped around
  the whole thing. Secondary affordances (a mode toggle, a preference switch, a
  context chip) sit in the `action` slot of `SectionHeader`, not loose beside the
  fields. Related options group into one container, not one card each. One footer
  closes the surface: the error on the left, exactly one primary button on the
  right, cancel and alternates as ghost or secondary. A stepper is the exception
  and needs the information to genuinely not fit one screen: only the workflow
  builder (goal, approach, steps) and the first-run onboarding wizard have one.
  Everything else scrolls.
- **Empty states teach the board model.** Every empty state says what the
  thing is, why it matters, and offers one action to create it. And it teaches
  the board, not the chat: set your first goal, what needs you, where spend
  goes. Never a dead end, never a "start chatting" prompt.
- **One layout for every lens empty state.** A lens with nothing to show
  renders `LensEmptyState`: a bordered inline row, the concept icon in its
  tone, title, description, at most one action. Never a centred hero inside a
  lens, the pane already carries the title. See
  [docs/design.md](docs/design.md) section 4.
- **Empty-state hierarchy follows the surface.** A surface's main empty state
  uses the large size and an `h2`. Inline and secondary empty states use the
  compact default or inline size and do not add a heading to the document
  outline.
- **Loading is a skeleton; running is a moving border. Spinners are
  forbidden.** No `Loader2`, no hand-built dot loaders, no parked spinner
  anywhere. _Loading_ uses the Skeleton primitive, a greyed placeholder
  mirroring the real layout (image block, title, chips), so the surface does
  not jump when content lands. _Running_ is expressed intrinsically by the
  element: a moving border (the `.spin-border` family) or a pulsing StatusDot,
  never a spinner beside it. The skeleton is part of the component: change the
  layout, update the skeleton in the same change. All of it stays motion-safe
  and reduced-motion gated.
- **Confirm what is destructive, nothing else.** Two-step confirms are for
  irreversible actions only; they must not tax routine clicks. The confirm
  happens in place: the row or button being acted on swaps itself for it, so
  the thing under threat stays on screen.
- **One card action grammar.** Every card declares two stable action slots:
  navigation at the top right, and lifecycle plus destructive actions at the
  bottom right. The navigation action is always visible. Hover reveal may
  expose lifecycle actions without moving either slot, and keyboard focus must
  reveal the same actions. Icon actions use the shared `Tooltip` component,
  never the native `title` attribute. Destructive actions keep their two-step
  confirmation.
- **A card in a collection keeps the card grammar; the sole occupant of a pane
  gets a header toolbar.** The two slots above are the grammar of a card sitting
  in a list, where a reader sweeps many of them and lifecycle actions must not
  compete with the next card's title. Once a record is rendered alone in a pane
  (the focused workflow run inside `FocusedPane`), it is a pane, not a card: its
  lifecycle and destructive actions move up to the header row beside the title,
  where a toolbar is expected and nothing is scrolled past to reach it. The
  guards are what keep that row safe: a mode toggle is a labelled pill with a
  pressed state, destructive actions stay ghost with danger tone on hover, a
  `<Divider>` and a gap separate the toggle from the destructive cluster, the
  toggle sits nearest the title and the destructive action at the far edge, and
  the order never changes.
- **One status owner per card.** A card says its state once. When a card carries
  a state strip, the strip owns the live sentence and the title pill drops back
  to the run outcome; the meta line keeps counts and spend and does not repeat
  what the strip already says.
- **Automation owns its advance.** With a hands-free mode on (workflow autorun),
  manual advance controls do not render: a button offering the click automation
  is about to make teaches the user that the mode does not work. The exception
  is the point where automation has stopped for good and says why (a failed
  step): there the recovery control stays. Precedent: GitHub Actions never
  offers "run the next job" mid-run, only approval gates and re-run; Vercel
  shows "Promote to production" only when auto-promotion is off.

## Motion

- All motion is gated by `motion-safe:` and respects `prefers-reduced-motion`.
- Motion **confirms**: a value rolled, a panel slid, a turn started. It never
  decorates. An animation that carries no meaning is cut.
- **Motion names who is working, and for how long.** A surface generating
  something right now (seconds) takes the moving border plus a pulsing dot: the
  wait is short and the motion is spent. A surface idle by design while
  something else runs (minutes to hours) stays static and alive by information
  instead: it names the step it waits on and ticks an elapsed counter in
  `tabular-nums`. A surface waiting on the user gets no motion at all, a
  `warning` tone and an explicit ask, because motion signals machine agency and
  animating "waiting for you" assigns the work to the wrong party. A surface
  that shimmers for hours teaches that its motion means nothing.
- `attention-ring` is the arrival halo: a finite outward breath (three cycles,
  then rest) on an element that now requires the user, never one that is
  working. It announces, then stands still; the tone keeps carrying the state.
  `spin-border` means working; `border-pulse` means a warning-stage card needs
  you; `attention-ring` means something new arrived for you.

## Accessibility

- Every icon-only button has an `aria-label`. Every interactive element is
  keyboard-reachable with a visible `focus-visible` ring.
- Color is never the only carrier of meaning: pair it with an icon, a word,
  or a shape.

## Principles

1. **The board is home, the rest are destinations**: chat, diff, terminal, and
   IDE are reached from cards, with zero capability loss.
2. **Pin the structure, flex the density**: learnable beats clever.
3. **Playful in marketing, surgical in product**: one register per surface.
4. **The element is the signal**: state lives in the surface, never a parked
   spinner.
5. **Cost is always one glance away**: no surprises, ever.
6. **Read inline, edit deliberately**: a transcript is a destination, not the
   home.
7. **One home per thing**: workspace identity, the session title, the rename,
   the collapse control each have exactly one mount. A second copy is a bug.
8. **Hidden is not gone**: a collapsed column peeks back on approach, so
   nothing needs a narrower copy of itself to stay reachable.
9. **Every pixel is intentional**: if it carries no meaning, cut it.

---

See [VISION.md](./VISION.md) for what Goodboy is,
[docs/design.md](./docs/design.md) for screen anatomy and surface ownership,
[docs/styling.md](./docs/styling.md) for the spacing / radius / scroll
mechanics, [docs/navigation.md](./docs/navigation.md) for the IA, and
[AGENTS.md](./AGENTS.md) + [CLAUDE.md](./CLAUDE.md) for code rules.
