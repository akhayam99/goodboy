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
  Its sections live in `website/src/sections/`, in this order: Nav, Hero,
  TwoWays, SharedContext, Tour, Install, Footer.
- `/features`, one cluster per topic, from `website/features.html` and
  `website/src/pages/features/`. The clusters, their groups and their copy come
  from `features.data.json` in that folder. Vite builds both pages as inputs,
  `vercel.json` serves them without `.html`, and the dev and preview servers
  rewrite `/features` the same way.

Each cluster shows its main features, not all of them. In `features.data.json`
every item of the guide stays in the file: 3 to 5 items per cluster carry
`main: true` and render as cards (four columns, two on a tablet, a swipe row on
a phone); every other item carries an `also` noun, and the nouns of the items
marked `shown: true` render as one plain "Also:" line of two lines at most (the
rest live in the area files). `guides` lists one `{ area, label }` per area file, shown as
"In the guide:" links to `docs/features/<area>.md` through
`SITE.featureDoc(area)`. A main item must also be a main item of that area in
the `FEATURES.md` index, and an item title is the heading (or small features
table row) it has in the area file. Check the page fails when they drift.

## Product views

The page shows no screenshots. Every product view is a React mock, built from
the same tokens as the page, so it is sharp at any zoom, follows the theme and
ships no raster file.

- `website/src/components/mocks/` holds the kit: `MockStage` puts a mock on a
  stage, `MockWindow` is the app window chrome, and `mocks.css` holds the shared
  look. Each scene (`SessionMock`, `BoardMock`, `InboxMock` and the rest) has its
  own `.tsx` and `.css`.
- A mock that plays runs once, when it scrolls into view, through
  `usePlayOnce`. It rests on its final state under `prefers-reduced-motion`.
- The hero mock is the one `MockStage` with `isHero`, which sets
  `data-hero-mock`. At least 380 px of it must show in the first 900 px at 1440.
- The only images are brand assets, see [docs/brand.md](../docs/brand.md).

## Theme

The page follows the system theme until the visitor picks one with the header
toggle, which is kept in `localStorage` under `goodboy-site:theme`. A script at
the top of `website/index.html` sets `data-theme` before the first paint, so
the page never flashes. Colours come from the tokens at the top of
`website/src/styles.css`, with a dark set under `:root[data-theme='dark']`:
one page background, a `--band` a step above it, the `--g-stage-gradient` token
behind every stage and mock (a flat 160 degree linear gradient, dark teal to
near black, with no sheen or glow, defined once in `website/src/styles.css`),
one raised surface for controls, hairlines instead of shadows, four text
tiers (`--t1` to `--t4`) and a teal `--accent` that marks text links and focus
rings only. The logo is always the dark tile with the white dog, in both
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

## Components

All in `website/src/components/`, each with its own CSS file.

- `Chapter`, a section with a `Statement` head and its blocks. `data-tone` is
  `page`, `band` or `stage`. Two neighbours never share a tone. Bands and
  stages each have a hairline above and below.
- `Statement`, an eyebrow, a heading and a lead of 20 words or fewer. No h1, h2
  or h3 ends with a period.
- `CardRow`, a row of cards, each a mock or a short caption. Its cards line up
  with the heading's left edge.
- `ProviderLine`, the Works with row, marked `data-works-with`. It must sit in
  the first screen on the home page.
- `NavMenu`, the sheet that holds the nav links on a phone.
- `StarButton`, a Star on GitHub link to `SITE.repo`, shown on touch devices in
  place of the downloads. On desktop the hero shows its own Star on GitHub button
  next to the download.
- `StarCount`, the star total inside every Star on GitHub button. `useStarCount`
  reads `stargazers_count` from `SITE.repoApi` once per session and
  `formatStars` floors it to the hundred: 100+, 200+, then 1.2k+. Under 100, or
  when the API fails, the button shows no number.
- `BrandIcons`, the provider marks, in their brand colours with the names in
  tier 3. Each hex is sourced and recorded in `brandIcons.source.json`.

A "learn more" link carries `data-see-more` and points at a `/features#cluster`
anchor. A link to a repo doc points at `FEATURES.md` or at
`docs/features/<area>.md`, and only from a `refLink` or the footer. The nav
marks the current page with `aria-current="page"`, in the desktop links and in
the phone sheet alike.

## Phones

A touch device is told by pointer, `(hover: none) and (pointer: coarse)`, never
by width. `.onlyFine` hides an element on touch and `.onlyCoarse` hides it with
a mouse, both in `src/styles.css`. On touch the hero download buttons and the
install block give way to `StarButton`. A phone has no
`[data-download]` element, and every button, `.btn` and nav link is 44 px tall
or more.

## Downloads

Downloads live in the hero and the install block only; the nav carries none.
Every `[data-download]` link is a direct file download from
`https://github.com/akhayam99/goodboy/releases/download/v<version>/<asset>`,
never the releases page. `src/data/downloads.ts` builds the four asset URLs
(`.dmg`, `.AppImage`, `.deb`, `.rpm`) from `LATEST_VERSION`, the newest
snapshot in `src/data/releases/`. That snapshot lands in the version bump
commit, before the release build attaches the assets, so for a short window the
build-time URL can 404. `useDownloads` closes that gap: once per session it
reads `api.github.com/repos/akhayam99/goodboy/releases/latest` (no auth, cached
in `sessionStorage`, failures ignored) and swaps in the real
`browser_download_url` of each matching asset. With no answer, the build-time
URL stays. Nothing falls back to the releases page.

`usePlatform` picks the primary button: macOS visitors get the DMG
("Download for macOS"), Linux visitors the AppImage ("Download for Linux") and
Install adds `.deb` and `.rpm` links. Any other system gets the macOS button
and a quiet "Linux build" link. The Homebrew line shows on macOS only, since
the tap holds casks and has no Linux formula. A phone has no download buttons.

## Check the page

`pnpm check:page [url...]` drives headless Chrome over a running page (default
`http://localhost:1499/`) at 1440, 1024, 768, 660 and 390 pixels wide, in
both themes, at twice the pixel density. The `/` and `/features` pages both
pass it. Tag Manager is blocked during the run.

Rules that run on every page:

- No horizontal overflow, no em dash or middot triplet in visible text, no
  heading that ends with a period, and Inter loaded.
- A section never runs into the next one, and its content never spills below
  it. The consent card never covers the h1.
- No raster image in `main`: no `img` and no `picture`.
- No shadow on a mock window or a stage, outside `data-shadow-exception`. A page
  with no `.mockStage` fails, so the rule cannot pass by finding nothing.
- Chapters alternate tones, and no two neighbours share one. Each chapter has
  at most one eyebrow; the tour has none, its tabs do that job. An eyebrow is a `FEATURES.md` group name verbatim, or one of the
  page eyebrows listed in the script (the hero's "Free desktop ADE, built in public", "Install" and "All features").
- On `/`, the first heading of each section sits on the shell's left edge,
  within 1 px, unless it is centred. On both pages, a card's title and caption
  share the card's left edge.
- Gradients: no gradient paints anything but `--g-stage-gradient`. A source scan
  of `website/src` fails on any `linear-`, `radial-` or `conic-gradient(` outside
  the token definition, except in a mask property or in a rule that also sets a
  mask, which is how the running-state ring in `kit/kit.css` is drawn. A
  computed-style scan of the page (pseudo-elements included) fails on any other
  painted gradient. Add no new gradient; use a flat colour.
- Board mock: the cards of a row, across the stage columns, differ in height by
  at most 1 px.
- Copy: a sentence has at most 20 words, and no word repeats across an eyebrow,
  heading and lead, apart from `goodboy`, `task`, `tasks` and the function
  words `your`, `with`, `that`, `this` and `from`.
- Links: every `data-see-more` points at a real `/features` anchor. A link to
  `FEATURES.md` or to a `docs/features/<area>.md` file sits only on a `.refLink`
  or in the footer, the file exists, and any anchor is a heading in it.
- Works with: `[data-works-with]` sits in the first screen on `/`.
- Download: the download buttons show on `/` with a mouse and never on a phone,
  and every `[data-download]` href starts with `/releases/download/`.

Budgets, in the `PAGE_BUDGETS` constant:

- `/`: at most 5000 px tall at 1440 and 6000 px on a phone, and no section over
  1100 px.
- `/features`: at most 8400 px tall at 1440 and 11500 px on a phone, and no
  cluster over 900 px at 1440 or 1300 px on a phone.
- The hero: at least 380 px of `[data-hero-mock]` shows in the first 900 px at
  1440, and the hero mock is fully opaque after load.

Phone run, which emulates touch:

- Visible text is 13 px or more, mock text included. A mock raises its small
  type to 13 px under `(hover: none) and (pointer: coarse)` in its own css or in
  `kit/kit.css`, and keeps its desktop size otherwise.
- Every button, `.btn`, nav link and menu link is 44 px tall or more.
- There is a visible menu button, and a visible `[data-star]` element.

Coverage, once per run: every group in `FEATURES.md` is in a cluster of
`features.data.json`, and every cluster has an element with its id on
`/features`. Each cluster has 3 to 5 main items, an `also` noun for every other
item, and a guide link whose label is the title of its area file and whose area
is one of its groups. Every `###` entry of those area files is an item of the
cluster, every item is a `###` entry or a small features table row of one of
them, and every main item is a main item of the `FEATURES.md` index. `--shots <dir>` also saves every heading, and `--verify-icons`
compares the provider mark paths with their pinned simple-icons files over the
network. The fill is free, since the marks carry brand colours. The heading rule
itself lives in [docs/tone-of-voice.md](../docs/tone-of-voice.md).

## One invented world

Every name, number and time on the page belongs to one invented world, and
every mock agrees with every other. The canon lives in
`apps/desktop/src/app/components/MockScene/scenes/brand/canon.ts`: workspace
Harborline with `payments-api`, `notify-relay` and `ledger-core`; the task
HBL-412 "Stop retried webhooks posting a second credit" on branch
`hl/fix-duplicate-credit`, with pull requests `payments-api` #318 and
`notify-relay` #57, while `ledger-core` is only read; $3.47 spent so far; the
people Dana R., Kenji W., Marta L. and Omar T. A repo the story only reads has
no branch or pull request in any mock, and any number in the copy matches the
mock next to it. Nothing on the page names a real person, customer or
repository. When the canon changes, it changes everywhere in one pass.
