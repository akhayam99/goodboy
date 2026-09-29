# Website

> **Read this when** you are changing, building or checking the landing page
> under `website/`. **Not for** the words on it (see
> [docs/tone-of-voice.md](../docs/tone-of-voice.md)) or the brand assets
> (see [docs/brand.md](../docs/brand.md)).

The landing page is a Vite and React app outside the pnpm workspace, built and
deployed by Vercel from `website/vercel.json`.

## Install and run

- Install from `website/` with `pnpm install --ignore-workspace`. The site
  keeps its own lockfile; why that matters is in
  [CONVENTIONS.md](../CONVENTIONS.md) → pnpm.
- `pnpm dev` serves the page locally; `pnpm build` typechecks and builds
  `dist/`.

## Pages

- `/`, the landing page, from `website/index.html` and `website/src/App.tsx`:
  the hero with the Works with row, three sections (jobs and models, what
  needs you, Stop re-explaining yourself), Also in Goodboy, Install and the
  footer. Its title, meta description and Open Graph text follow the hero,
  and so does the OG image in `website/scripts/build-brand-assets.mjs`.
- `/features`, every feature group with the release picker and the supported
  tools, from `website/features.html` and `website/src/pages/features/`. Vite
  builds both as inputs, `vercel.json` serves them without `.html`, and the
  dev and preview servers rewrite `/features` the same way.

## Structured data

`website/index.html` carries one `SoftwareApplication` JSON-LD block. Its
description matches the meta description; change both in the same commit. The
page has no FAQ section, so it carries no `FAQPage` block: search engines
expect every answer in it to be visible on the page.

## Product pictures

The product pictures are HTML, not screenshots, so they stay sharp at any
density and re-lay out on a phone instead of being cropped. Each one lives in
`website/src/components/mocks/` (`Board`, `RunList`, `Activity`, `Handoff`),
takes its words and numbers from `website/src/data/harborline.ts`, and sits
on a `Stage`. Their rules:

- Rows are grids with `minmax(0, 1fr)` for the title. A title never wraps; it
  ends in an ellipsis. Below 520 px of container width each row turns into two
  clean lines, never a word per line. The breakpoints are container queries,
  so they hold inside any stage.
- Text that says what an agent does, such as a run step, carries `data-wrap`.
  Below 520 px it wraps to two lines and is never cut.
- The run is a timeline that reads top to bottom: a status node per step on
  a rail, solid down to the step that runs and dashed after it. Above 520 px
  each step is one row of columns, below it each step stacks on three lines.
- On a phone every visible text is 13 px or larger; on a desktop 12 px is the
  floor, for chips and eyebrows only.
- The window is a hairline box on the page background, with no shadow.

The site keeps no raster product images. A raster image added later is
exported at exactly 1, 2 and 3 times the width it is drawn at, and checked at
100%.

## Theme

The page follows the system theme until the visitor picks one with the header
toggle, which is kept in `localStorage` under `goodboy-site:theme`. A script at
the top of `website/index.html` sets `data-theme` before the first paint, so
the page never flashes. Colours come from the tokens at the top of
`website/src/styles.css`, with a dark set under `:root[data-theme='dark']`:
one page background, a `--band` a step above it for every other chapter, a
`--stage` for product images (a flat 160 degree linear gradient, teal to
page gray, taken from the earlier site, with no sheen, glow or shadow), one
raised surface for controls, hairlines instead of shadows, four text tiers (`--t1` to `--t4`) and a teal `--accent` that marks text links and
focus rings only. The logo is always the dark tile with the white dog, in both
themes.

## Type

The site is set in Inter, the same 72,920 byte Latin variable file the app
ships, copied to `website/public/fonts/InterVariable-latin-v19.woff2` and
preloaded from `website/index.html`. `font-optical-sizing: auto` picks the
display drawing from 32 px up, so there is no separate display file. The type
roles live as `--t-*` tokens next to the colours: 64, 48 and 32 for headings,
20 for a lead, 16 for body, 15 for a cell, and weights 400, 500 and 600 only.
The subset carries no `cv11` or `ss01` alternates, so the site sets only
`calt`. `website/scripts/build-brand-assets.mjs` embeds the same file, so the
OG image renders in Inter on a machine without it installed.

## Cookie consent

The consent card is iubenda's Cookie Solution, embedded in `website/index.html`
rather than through Google Tag Manager, so the repo owns its language, position
and look. It asks in Italian, sits at the bottom left, and takes its colours
from `website/src/styles/consent.css`; the `onBannerShown` callback drops
iubenda's inline colours so the site tokens apply in both themes. Consent Mode
defaults to denied before any tag loads. iubenda shows no card for a language
the cookie policy lacks, and the policy has only an Italian version, so the
embed uses `lang: 'it'` and goes back to `'en'` once an English policy exists
in the iubenda dashboard. The GTM iubenda tag stays paused so the card never
loads twice.

## Page kit

- `Beat`, a section with a muted lead-in (optional, always smaller than the
  heading: 20 against 44 px, 17 against 30 on a phone), an h2, one body
  paragraph, `.textLink` links to `FEATURES.md` anchors, optional fine print,
  then one picture on a `Stage`. `isBand` puts it on `--band` with a hairline
  above and below; the first and third sections are banded.
- `Stage`, the colored stage behind a picture: the flat 160 degree gradient,
  radius 28, 48 px around the picture (32 below 1100 px, 20 below 860, 12 on a
  phone). No sheen, glow or shadow.
- Also in Goodboy, one row per feature that the page does not tell, each a
  link to its `FEATURES.md` section, in two columns (one below 760 px). A new
  feature gets at most a row here; `FEATURES.md` explains it.
- Install, with the Homebrew command, the downloads and three facts. It takes
  the place of a FAQ, a support block and a closer.

No h1, h2 or h3 ends with a period.

## Phones

A touch device is told by its pointer, not by its width:
`@media (hover: none) and (pointer: coarse)`, as the site did before 0.1.75. A
narrow desktop window keeps its downloads, a tablet with a trackpad reports a
fine pointer and sees them too. `.onlyFine` hides an element on a touch device
and `.onlyCoarse` shows it only there, both in `website/src/styles.css`, so
the right buttons show on the first paint without JavaScript.

- A touch device sees no download button, no Homebrew command and no Download
  in the nav. The hero and Install show a "Star on GitHub" button instead, a
  static link with no live count, next to a line that says to open the page on
  a computer. Only Install adds "See every feature", so the hero board starts
  higher on the first screen.
- Every download link and the Homebrew block carry `data-download`, and the
  star button `data-star`, so `check-page` can find them.
- The footer stacks on a phone: the brand on its 40 px dark tile, then the link
  groups in two columns, each link a 44 px row at 16 px.

## Motion

- Below the hero, every lead-in, heading, body, picture, row and fact fades
  and rises 12 px over 450 ms as it scrolls into view, 60 ms apart within a
  block (`useReveal`, which marks `[data-reveal]` nodes shown). Content stays
  visible until the observer is armed.
- The hero copy rises in on load; the hero picture is there on the first
  paint.
- Each picture plays one calm change once, when 40% of it is in view
  (`useAlive`): a task moves to Needs you, a run finishes step by step while
  its total counts up, an agent stops to ask, a turn moves from Claude to Codex
  with the same brief. Transitions run 200 to 450 ms and move 12 px at most.
  Nothing loops, scales, glows or blurs.
- The provider marks in the Works with row are in their brand colours (Claude
  orange, OpenRouter slate, the Gemini gradient from its 2025 mark, Codex the
  OpenAI green, Cursor its orange, OpenCode and Moonshot their own accent
  blues, each hex sourced and recorded in `brandIcons.source.json`), with the
  names in tier 3. They scroll as a marquee on a phone and sit still on wider
  screens.
- `prefers-reduced-motion` turns all of it off: every picture shows its final
  state and nothing fades.

## Check the page

`pnpm check:page [url...]` drives headless Chrome over a running page (default
`http://localhost:1499/`) at 1440, 1024, 768, 660, 430, 390 and 360 pixels
wide, in both themes, at twice the pixel density, with reduced motion on so
every picture shows its final state. The three phone runs emulate touch, so
they get a coarse pointer. It fails on:

- horizontal overflow, an image drawn below 2x, or a shadow on a stage or
  anything inside it;
- a product picture (a mock window or a picture) that shows less than 98% of
  itself inside the boxes that clip it;
- a home page taller than 5,500 px at 1440 or 7,500 on a phone;
- an em dash or a middot triplet in visible text, or a heading that ends with
  a period;
- a section that runs into the next one or whose content spills below it;
- Inter not loaded, a hero stage that starts below the first screen at 1440,
  or a consent card over the h1;
- on the touch run, a visible download link or Homebrew block, no Star on
  GitHub button, any visible text under 13 px, or a `data-wrap` text that is
  cut; on the other runs, a visible
  star button or no download link;
- a lead-in that is not smaller than its heading;
- an eyebrow outside the one register: a feature eyebrow (`kind="group"`, the
  default) must be a `FEATURES.md` group name verbatim, an audience eyebrow a
  `README.md` section, and the few page eyebrows (hero, Install, All
  features) are listed in the script;
- a `.textLink`, a nav link or an Also in Goodboy row that points anywhere in
  the repo's docs other than `FEATURES.md`, or whose anchor is not a heading
  in the current `FEATURES.md`. The GitHub repo, releases, changelog, security
  and legal links are unaffected.

The heading rule itself lives in
[docs/tone-of-voice.md](../docs/tone-of-voice.md). `--shots <dir>` also saves
every heading, and `--verify-icons` compares the provider mark paths with
their pinned simple-icons files over the network; the fill is free, since the
marks carry brand colours. Tag Manager is blocked during the run.

## One invented world

Every name, number and time on the page belongs to one invented world, and
every figure agrees with every other. The canon lives in
`apps/desktop/src/app/components/MockScene/scenes/brand/canon.ts`: workspace
Harborline with `payments-api`, `notify-relay` and `ledger-core`; the task
HBL-412 "Stop retried webhooks posting a second credit" on branch
`hl/fix-duplicate-credit`, with pull requests `payments-api` #318 and
`notify-relay` #57, while `ledger-core` is only read; $3.47 spent so far; the
people Dana R., Kenji W., Marta L. and Omar T. A repo the story only reads has
no branch or pull request in any figure, and any number in the copy matches the
figure next to it. The site's pictures take their words and numbers from
`website/src/data/harborline.ts`; the run total, $3.07 against $9.80 on one
heavy model, is labelled an example run. Nothing on the page names a real person, customer or
repository. When the canon changes, it changes everywhere in one pass.
