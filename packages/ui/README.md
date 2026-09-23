# @goodboy/ui

> **Read this when** you're about to add or use a component here and need the list of primitives and how theming works. **Not for** what does or doesn't belong in this package. See `CONVENTIONS.md`.

Shared presentational React components. No business logic, no Tauri APIs, no data fetching.

Theme rules that never change live in [DESIGN.md](../../DESIGN.md). Components
style themselves with semantic tokens from the app's theme registry.

## Primitives

`src/index.ts` lists the package's public primitives. Public props types are
exported there only when they are meant to be part of the API. Read that barrel
instead of a list here, because a list here goes stale on the next addition.

Three exports are required, not optional ([docs/styling.md](../../docs/styling.md) owns the rules):

- `ScrollFade` wraps every scroll region. A bare `overflow-y-auto` is a bug.
- `Divider` separates regions. [docs/styling.md](../../docs/styling.md) owns
  the rule about siblings and container borders.
- `tintClasses(tone)` resolves every semantic tone. A tone map inside one file is a bug ([DESIGN-SYSTEM.md](./DESIGN-SYSTEM.md)).

`AppShell` is the app skeleton, and the one exception to "presentational only". It owns the column template, the saved column widths, the smaller states a column can shrink to, and the overlay slots. It offers those states. [docs/navigation.md](../../docs/navigation.md) decides which ones the product uses, and why. What each surface is for lives in [DESIGN.md](../../DESIGN.md).

## Design tokens

The tokens live in `apps/desktop/src/styles.css` under `@theme`. Scales, color and tone, and the z-index registry are documented in [DESIGN-SYSTEM.md](./DESIGN-SYSTEM.md).

- **Motion policy**: every `transition-*`, `animate-*`, or `duration-*` class needs the `motion-safe:` prefix (it respects `prefers-reduced-motion: reduce`). No tool enforces this: there is no eslint config, and pre-commit runs only prettier. Review catches it, or it ships.

## Conventions

See [CONVENTIONS.md](./CONVENTIONS.md).
