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

- `ScrollFade` wraps every scroll region.
- `Divider` separates regions.
- `tintClasses(tone)` resolves every semantic tone ([DESIGN-SYSTEM.md](./DESIGN-SYSTEM.md) owns the tone map).

`AppShell` is the app skeleton, and the one exception to "presentational only". It owns the column template, the saved column widths, the smaller states a column can shrink to, and the overlay slots. It offers those states. [docs/navigation.md](../../docs/navigation.md) decides which ones the product uses, and why. What each surface is for lives in [DESIGN.md](../../DESIGN.md).

## Design tokens

The tokens live in `apps/desktop/src/styles.css` under `@theme`. Scales, color and tone, the z-index registry and the motion registry are documented in [DESIGN-SYSTEM.md](./DESIGN-SYSTEM.md). The motion gating rule belongs to [DESIGN.md](../../DESIGN.md#motion).

## Conventions

See [CONVENTIONS.md](./CONVENTIONS.md).
