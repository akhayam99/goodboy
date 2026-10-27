# Recipe: a UI primitive

> **Read this when** you add or change a component in `packages/ui`. **Not for**
> a feature component (it stays in its feature folder).

## Steps

1. Check [DESIGN-SYSTEM.md](../../packages/ui/DESIGN-SYSTEM.md) and its pages in `packages/ui/design/` for an existing primitive or type role first. A second primitive for the same job is a bug.
2. Add the component file under `packages/ui/src/components/` with a local `type Props`, one export, no default export.
3. Take values from tokens and the type scale; the parent's `gap` spaces siblings.
4. An icon-only control carries a tooltip through `IconButton` or `Tooltip`, never a native `title`.
5. Export it from the package entry and document its use in the page of `packages/ui/design/` that owns its family, or in [DESIGN-SYSTEM.md](../../packages/ui/DESIGN-SYSTEM.md) when it is a token or a scale.

## Test

A test beside it: role and accessible name, keyboard, focus return. No class assertions.

## Docs that move

[DESIGN-SYSTEM.md](../../packages/ui/DESIGN-SYSTEM.md), [styling.md](../styling.md) when a mechanic is new, [iconography.md](../iconography.md) for an icon.

## Failure-mode rows that apply

Renamed `aria-label`, second window (focus), late response.

## Guards

`sibling-margin`, the design-system ratchets (type roles, `ScrollFade`), the accessibility suite.
