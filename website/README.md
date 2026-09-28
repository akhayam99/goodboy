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

Product figures are real app screenshots from the brand mock scenes (see
[docs/mock-screenshots.md](../docs/mock-screenshots.md)), captured at 1440 by
900 CSS pixels with a device scale factor of 4, in both app themes. Headless
Chrome needs `--disable-site-isolation-trials`, or a wireframe or report frame
renders at scale 1 and comes out soft. They live in `website/public/img/` as
WebP:

- `<id>.webp`, the full capture scaled down to 3840 pixels wide at quality 90,
  and `<id>-light.webp`, the same scene in the app's light theme.
- `<id>-d1.webp`, `<id>-d2.webp` and their `-light` twins, crops of one part of
  the scale 4 capture at quality 92, never resized. Keep a crop between 1:1 and
  3:1: a longer strip turns into a sliver on a phone.

Every image carries at least twice the pixels of its largest rendered size, at
1440 and at 390 wide. `website/src/figures.ts` holds each figure's size, alt
text and its detail crops with their captions. `Shot` in
`website/src/components/Shot.tsx` frames the capture as a window on a stage and
loads only the image of the active theme. On a wide screen the detail crops
overlap the bottom of the stage at equal height. A phone gets the same page:
the same sections, text and figures in the same order, with the stage full
bleed, the window at full width and the crops stacked under it. When a
screenshot is recaptured, cut its detail crops again from the new capture.

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

## Verify with the page

Check the rendered page, not the diff:

- Headless Chrome with `--force-prefers-reduced-motion` renders every
  section's final state. It drives neither CSS animations nor intersection
  observers, so check each figure's play in a real browser.
- No horizontal overflow at 375px wide.
- `pnpm build` clean and no em dash anywhere in the copy.

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
