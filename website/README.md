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

## Reveal classes

`useRevealAll` in `website/src/components/Reveal.tsx` adds the `in` class to
every `.rv` element straight on the DOM once it scrolls into view. React owns
the `className` of any element it renders with a state class, so a re-render
drops `in` and the element stays at `opacity: 0`. Keep state classes on an
inner node, never on the element that carries `rv`.

## Verify with the page

Check the rendered page, not the diff:

- Headless Chrome with `--force-prefers-reduced-motion` renders every
  section's final state. It drives neither CSS animations nor intersection
  observers, so check each figure's play in a real browser.
- No horizontal overflow at 375px wide.
- `pnpm build` clean and no em dash anywhere in the copy.

## One invented world

Every name, number and time on the page belongs to one invented world, and
every figure agrees with every other. The canon: workspace `acme`; projects
`api`, `web`, `mobile`, `billing`, `auth`, `search`, `docs` and `infra`; the
main session "Ship LIN-241, bulk archive for notifications" touching `api` and
`web` on branch `gb/lin-241-bulk-archive`, with pull requests `api` #1045 and
`web` #3050; a reviewer called `sam`. Nothing on the page names a real person,
customer or repository. When the canon changes, it changes everywhere in one
pass.
