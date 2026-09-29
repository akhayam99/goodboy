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

- `/`, the landing page, from `website/index.html` and `website/src/App.tsx`.
- `/features`, every feature group with the release picker and the supported
  tools, from `website/features.html` and `website/src/pages/features/`. Vite
  builds both as inputs, `vercel.json` serves them without `.html`, and the
  dev and preview servers rewrite `/features` the same way.

## Figures

Product figures are real app screenshots from the mock scenes (see
[docs/mock-screenshots.md](../docs/mock-screenshots.md), Landing crops),
captured at a device scale factor of 4 or more, in both app themes. They live
in `website/public/img/` as WebP, each at three widths and never upscaled.
The widths are exactly 1, 2 and 3 times the size the image is drawn at, so a
screen at 1x, 2x or 3x shows the file pixel for pixel and the browser never
resamples it:

- `<id>-<width>.webp` in the dark theme and `<id>-<width>-light.webp` in the
  light one.
- A frame is drawn 1144 CSS pixels wide at 1440, inside its stage, so its
  files are 1144, 2288 and 3432 wide. A 1024 pixel app window lands at 1.12
  times its size; the board keeps a 1250 pixel window so its four columns fit,
  and draws at 0.92.
- A frame has a `<id>-phone` twin, a 4:5 cut of the window between 288 and 375
  app pixels wide that a 390 phone draws 366 wide, at 0.98 to 1.27 times the
  app, instead of the whole window shrunk. Its right edge fades out on a
  phone, so a row that runs on reads as the app continuing. Its files are
  732, 1098 and 1464 wide.
- A fragment is one component, drawn at its `displayWidth`, at least 1.18
  times its size in the app, with files at 1, 2 and 3 times that width. App
  text never draws below its size in the app.

`website/src/figures.ts` holds each figure's id, pixel size, display width and
alt text. `Picture` loads only the active theme and lets the browser pick the
width through `srcset`, and `pnpm check:page` fails when any image draws below
twice its displayed size. When a scene changes, reshoot every width and both
themes of its figures in one pass.

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

The page is built from five formats in `website/src/components/`, each with
its own CSS file:

- `Chapter`, a section with a `Statement` head, then its blocks 96 px apart
  (64 on a phone). `isBand` puts it on `--band` with a hairline above and
  below; How it works, Workflows, Questions and Install are banded, the
  chapters between them are not.
- `Statement`, an eyebrow, a heading and a lead of 20 words or fewer. The
  hero and the closer use it too. No h1, h2 or h3 ends with a period.
- `Frame`, one full product view on a stage: 64 px of stage around the view
  (40 below 1100 px), radius 28, the view capped at 600 px (640 in the hero)
  and faded out over 140 px. Below 860 px the stage runs edge to edge with 12
  px around the view, and a phone shows a 4:5 crop of its own. `isCanvas`
  fades the view's top and bottom into the stage and adds a soft neutral
  shadow above and below it: the one shadow on the page, used only for the
  workflow step graph and marked `data-shadow-exception` for the check.
- `Fragment`, a split of text beside one or two components on a smaller
  stage (radius 20), the component bleeding off its right and bottom edge
  where the screen continues. It stacks below 900 px. On a phone the stage
  runs edge to edge and the picture is drawn at 0.58 of its size, whole from
  top to bottom, and fades out on the right where it is wider than the stage.
- `Grid`, two or three cells, each a stage with a component bleeding off it,
  then a title and one line. No box around the cells. On a phone the stage runs
  edge to edge and the picture is drawn at 0.58 of its size, fading out on the
  right where it is wider than the stage.

Motion: the hero rises in on load. Below it, every frame, fragment, grid
image and frame note fades and rises 14 px as it scrolls into view
(`useReveal`, which marks `[data-reveal]` nodes shown), and the cost bars grow
from zero when their pair appears. The provider marks in the Works with row are in their
brand colours (Claude orange, OpenRouter slate, the Gemini gradient from its
2025 mark, Codex the OpenAI green, Cursor its orange, OpenCode and Moonshot
their own accent blues, each hex sourced and recorded in
`brandIcons.source.json`), with the names in tier 3. They scroll as a marquee
on a phone and sit still on wider screens. `prefers-reduced-motion` turns all
of it off.

`Picture` serves every image as a `srcset` of its three widths, so a browser
downloads only what its screen needs.

## Check the page

`pnpm check:page [url...]` drives headless Chrome over a running page (default
`http://localhost:1499/`) at 1440, 1024, 768, 660 and 390 pixels wide, in
both themes, at twice the pixel density. It fails on horizontal overflow, an
image drawn below 2x, a frame, fragment or grid with a shadow (outside
`data-shadow-exception`), a page taller
than 14,300 px at 1440 or 15,000 on a phone, an em dash or a middot triplet in
visible text, a heading that ends with a period, a section that runs into the
next one or whose content spills below it, Inter not loaded, a hero frame that
starts below the first screen at 1440, and a consent card over the h1, and an
eyebrow outside the one register: a feature
eyebrow (`kind="group"`, the default) must be a `FEATURES.md` group name
verbatim, an audience eyebrow a `README.md` section, and the few page eyebrows
(hero, Questions, Install, All features) are listed in the script. The heading
rule itself lives in [docs/tone-of-voice.md](../docs/tone-of-voice.md). `--shots <dir>` also saves every heading, and
`--verify-icons` compares the provider mark paths with their pinned
simple-icons files over the network; the fill is free, since the marks
carry brand colours. It also fails a `.textLink` (a "learn more" or "How X
works" link), a nav link or a footer Docs-column link that points anywhere in
the repo's docs other than `FEATURES.md`, or whose anchor is not a heading in
the current `FEATURES.md`; the GitHub repo, releases, changelog, security and
legal links are unaffected. Tag Manager is blocked during the run.

Phones: a touch device is told by pointer, `(hover: none) and (pointer: coarse)`,
never by width. `.onlyFine` hides an element on touch and `.onlyCoarse` hides it
with a mouse, both in `src/styles.css`. On touch the nav Download, the hero
download buttons, the install block (Homebrew command, Download for macOS, Linux
builds and the five-minutes note) give way to
`StarButton`, a Star on GitHub link to `SITE.repo`. The phone run of
`check:page` emulates touch and fails on a visible `[data-download]` element or
a missing `[data-star]` one, and on a Star button with a mouse.

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
figure next to it. Nothing on the page names a real person, customer or
repository. When the canon changes, it changes everywhere in one pass.
