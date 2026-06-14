# Goodboy — Design

How Goodboy looks, reads, and feels. `CONVENTIONS.md` governs the code; this
governs the surface. These are rules, not suggestions — when a screen feels
off, it has broken one of them.

> **North star**: Cursor's calm. Linear's typographic discipline. Stripe's
> number-density. A whisper of Warp's command-surface. Goodboy is playful in
> its marketing and surgical inside the app — never both at once.

## The editorial line

Goodboy is a professional developer tool and should read as one: intentional,
dense without being noisy, fast, opinionated.

Playfulness has a place — the splash screen, onboarding, the marketing site.
The working surface does not: inside the app, copy and UI stay plain and
functional. One register per surface; let the other supply only texture.

## Voice & copy

- **Speak the domain language.** Agent, session, workspace, workflow, plan —
  the interface uses these words consistently and doesn't coin synonyms or
  aliases for them.
- **English only.** Code, copy, commits, docs.
- **Terse and direct.** Labels are nouns or verbs, not sentences. Help text
  earns its place or is cut. No exclamation marks, no cheerleading.
- **Sentence case** for buttons, headings, and menu items — never Title Case,
  never ALL CAPS except tiny eyebrow labels.
- **Say what a thing does, not how it feels.** "No plans yet" beats "Looks
  empty in here!".

## Layout & navigation

- **Three-pane shell**: workspaces sidebar (where am I, what's running) ·
  chat (the work) · right pane (session detail and artifacts). Each pane owns
  one job; the right pane shows the active session's state alongside its plans,
  PRs, and other work products.
- **Sidebar is presence, palette is transit.** The sidebar answers "where am
  I"; the command palette (⌘K) answers "where do I want to be". They must not
  compete — navigation belongs to the palette, spatial state to the sidebar.
- **Pin the structure, flex the density.** Nothing appears or disappears at a
  count threshold. Panels collapse to a rail; they never vanish. A control's
  position is fixed so it can be learned.
- **Settings match the scope they edit.** Configuration splits into three
  surfaces by ownership: application settings is a full-page studio; workspace
  and session settings are lightweight scoped panes. Each surface edits only
  what belongs to its scope. Changes save instantly — no Save/Cancel footer, no
  stacking one settings surface on another. The scope of a setting matches the
  scope of the surface it's edited on.
- **One overlay slot.** Full-surface editors — new session, workflow builder,
  scoped settings, plan studio, diff viewer — share a single overlay spanning
  the main and right panes. Only one occupies it at a time, by strict
  precedence; they never stack as competing dialogs. Scope decides the pattern:
  session- and workspace-scoped editors take the overlay slot so the workspaces
  sidebar stays visible; app-level studios are full-page; transient
  confirmations are dialogs.

## Density

Three named grades, driven by tokens (`--density-{compact,cozy,comfortable}`):

- **Compact** — the sidebar. Maximum information, minimum chrome.
- **Cozy** — the context panel, the composer, tool/system transcript rows.
- **Comfortable** — human and assistant prose in the transcript. Built for
  reading, not scanning.

Conversation reads as conversation; tool calls read as a devtool. Never let
the two collapse into the same texture.

## Color & theme

- **Dark by default** (developer-tool convention), light fully supported,
  system preference as an opt-in third state.
- Color comes from **semantic tokens** — `success`, `warning`, `danger`,
  `info`, `merged`, the surface-elevation ramp, per-provider accents. A raw
  hex in a component is a bug.
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
- **Chips carry a word.** Status chips — PR state, CI, agent kind — pair an
  icon with a label. Icon-only is allowed only where space is truly gone, and
  then the label survives as a tooltip.
- **Control markers render, never leak.** In-band control signals — tool calls,
  clusters, plans — surface as structured cards and chips drawn from one shared
  accent mapping, so a kind of signal reads the same wherever it appears. A raw
  marker never reaches the transcript.

## Spend

Cost is never more than a glance away. The cost badge belongs anywhere a unit
of work is shown — session rows, agent rows, the transcript turn, the input
footer. Numbers are always `tabular-nums`. Money shows intent: a live estimate
before sending, a running total after.

## Components & interaction

- **Tabs when you return, accordion when you'd forget.** Tabs reward "I came
  back to find this"; accordions reward discovery. The right pane is tabs.
- **Read inline, edit on a focused surface.** Plans and PR bodies render in
  place; editing opens a focused surface — a modal or an overlay pane. The
  transcript is for reading.
- **Empty states teach.** Every empty state says what the thing is, why it
  matters, and offers one action to create it. Never a dead end.
- **Loading is a skeleton, not a spinner.** A card or substantial element
  loads as a greyed placeholder mirroring its real layout (image block, title,
  chips), so the surface does not jump when content lands. A bare spinner is
  only for the first load of an empty region with no shape to mirror yet. The
  skeleton is part of the component: change the layout, update the skeleton in
  the same change.
- **Confirm what is destructive, nothing else.** Two-step confirms are for
  irreversible actions only — they must not tax routine clicks.

## Motion

- All motion is gated by `motion-safe:` and respects `prefers-reduced-motion`.
- Motion **confirms** — a value rolled, a panel slid, a turn started. It never
  decorates. An animation that carries no meaning is cut.

## Accessibility

- Every icon-only button has an `aria-label`. Every interactive element is
  keyboard-reachable with a visible `focus-visible` ring.
- Color is never the only carrier of meaning — pair it with an icon, a word,
  or a shape.

## Principles

1. **Pin the structure, flex the density** — learnable beats clever.
2. **Playful in marketing, surgical in product** — one register per surface.
3. **The element is the signal** — state lives in the surface, not beside it.
4. **Cost is always one glance away** — no surprises, ever.
5. **Read inline, edit deliberately** — the transcript is for reading.
6. **Every pixel is intentional** — if it carries no meaning, cut it.

---

See [VISION.md](./VISION.md) for what Goodboy is,
[docs/styling.md](./docs/styling.md) for the spacing / radius / scroll
mechanics, and [AGENTS.md](./AGENTS.md) + [CLAUDE.md](./CLAUDE.md) for code
rules.
