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
[docs/mock-screenshots.md](../docs/mock-screenshots.md)), dark theme, captured
at 1440 CSS pixels wide with a device scale factor of 2.667, so each is 3840
pixels wide. They live in `website/public/img/` as WebP at quality 88:

- `<id>.webp`, the full capture, and `<id>-1920.webp`, the same image at half
  size. `Shot` serves both through `srcset`, and its `sizes` asks for twice
  the phone's width so a phone with a device scale factor of 3 gets the full
  capture and stays sharp when pinched.
- `<id>-d1.webp` and `<id>-d2.webp`, crops of one part of the capture at full
  resolution, never resized. Keep a crop between 1:1 and 3:1: a longer strip
  turns into a sliver on a phone.

`website/src/figures.ts` holds each figure's size, alt text and its detail
crops with their captions. `Shot` in `website/src/components/Shot.tsx` frames
the capture as a window on a dark stage. On a wide screen the detail crops
overlap the bottom of the stage at equal height. A phone gets the same page:
the same sections, text and figures in the same order, with the stage full
bleed, the window at full width and the crops stacked under it. When a
screenshot is recaptured, cut its detail crops again from the new capture.

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
