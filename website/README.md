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

## FAQ and structured data

The questions in `website/src/sections/Faq.tsx` are mirrored by hand into the
`FAQPage` JSON-LD block in `website/index.html`. Change both in the same
commit: nothing checks that they agree, and search engines read the JSON-LD,
not the section.

## Figures

Product figures are real app screenshots from the mock scenes (see
[docs/mock-screenshots.md](../docs/mock-screenshots.md), Landing crops),
captured at a device scale factor of 4 or more, in both app themes. They live
in `website/public/img/` as WebP, each at three widths and never upscaled:

- `<id>-<width>.webp` in the dark theme and `<id>-<width>-light.webp` in the
  light one, for `<width>` 1200, 2400 and 3840.
- A frame has a `<id>-phone` twin, a 4:5 cut of the same screen that a phone
  shows instead of the whole window shrunk.
- A fragment is one component, drawn on the page at its `displayWidth`, at
  least 1.3 times its size in the app, so its smallest text lands at 13 CSS
  pixels or more.

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
one page background, one raised surface, hairlines instead of shadows, four
text tiers (`--t1` to `--t4`) and a teal `--accent` that marks text links and
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
and look. It asks in English, sits at the bottom left, and takes its colours
from `website/src/styles/consent.css`; the `onBannerShown` callback drops
iubenda's inline colours so the site tokens apply in both themes. Consent Mode
defaults to denied before any tag loads. iubenda shows no card for a language
the cookie policy lacks, so the policy needs an English version in the iubenda
dashboard, and the GTM iubenda tag stays paused so the card never loads twice.

## Page kit

The page is built from five formats in `website/src/components/`, each with
its own CSS file:

- `Chapter`, a section under a hairline rule: a `Statement` head, then its
  blocks 96 px apart (64 on a phone).
- `Statement`, an eyebrow, a heading with an optional second sentence in tier
  3, and a lead of 20 words or fewer. The hero and the closer use it too.
- `Frame`, one full product view: an 8 px bezel on the raised surface, a view
  capped at 600 px (640 in the hero) that fades out over 140 px, and on a
  phone a 4:5 crop of its own.
- `Fragment`, a split of text beside one or two components shown larger than
  in the app, faded to the right where the screen continues.
- `Grid`, two or three cells in one bordered box, each a fragment, a title and
  one line.

`Picture` serves every image as a `srcset` of 1200, 2400 and 3840 pixel files,
so a browser downloads only what its screen needs.

## Check the page

`pnpm check:page [url...]` drives headless Chrome over a running page (default
`http://localhost:1499/`) at 1440 by 900 and 390 by 844, in both themes, at
twice the pixel density. It fails on horizontal overflow, an image drawn below
2x, a frame, fragment or grid with a shadow, a page taller than 13,500 px on
the desktop or 13,000 on a phone, an em dash or a middot triplet in visible
text, Inter not loaded, a hero frame that starts below the first screen, and a
consent card over the h1. `--shots <dir>` also saves every heading, and
`--verify-icons` compares the provider marks with their pinned simple-icons
files over the network. Tag Manager is blocked during the run.

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
