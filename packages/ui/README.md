# @goodboy/ui

> **Read this when** you're about to add or use a component here and need the primitive catalogue and theming model. **Not for** what does/doesn't belong in this package. See `CONVENTIONS.md`.

Shared presentational React components. No business logic, no Tauri APIs, no data fetching.

Theme invariants live in [DESIGN.md](../../DESIGN.md). Components style
against semantic tokens from the app theme registry.

## Primitives

`src/index.ts` is the catalogue of the package's public primitives. Public
props types are exported there only when they are intentionally part of the
API. Read the barrel instead of a list here, which rots on the next addition.

Three exports are not a choice ([docs/styling.md](../../docs/styling.md) owns the rules):

- `ScrollFade` wraps every scroll region. A bare `overflow-y-auto` is a bug.
- `Divider` separates regions. [docs/styling.md](../../docs/styling.md) owns
  the sibling and container-border rule.
- `tintClasses(tone)` resolves every semantic tone. A per-file tone map is a bug ([DESIGN-SYSTEM.md](./DESIGN-SYSTEM.md)).

`AppShell` is the app skeleton and the exception to "presentational only": it owns the column template, the persisted widths, the reduced states a column can take and the overlay slots. It offers those states; which ones the product uses, and why, is [docs/navigation.md](../../docs/navigation.md)'s. What each surface is for lives in [DESIGN.md](../../DESIGN.md).

## Design tokens

Tokens physically live in `apps/desktop/src/styles.css` under `@theme`. Scales, color and tone, and the z-index registry are documented in [DESIGN-SYSTEM.md](./DESIGN-SYSTEM.md).

- **Motion policy**: every `transition-*`, `animate-*`, or `duration-*` class needs the `motion-safe:` prefix (respects `prefers-reduced-motion: reduce`). Nothing enforces it: no eslint config, pre-commit runs prettier only. Review catches this or it ships.

## Conventions

See [CONVENTIONS.md](./CONVENTIONS.md).
