# Recipe: a drawer, a studio or a page

> **Read this when** you add a page, a studio or a right drawer. **Not for**
> spacing and scroll mechanics ([styling.md](../styling.md)).

## Steps

1. Pick the frame type of the page from the frame map in [styling.md](../styling.md#the-frame-map): column, reader, stage or split. Add the page to `PAGE_FRAME` in `packages/ui/src/frameGeometry.ts`; a page with no entry fails typecheck.
2. A studio names its page in `STUDIO_META` so the band tier agrees with the frame.
3. A right drawer is its own container beside the page container, never a panel inside it (R1): both framed, a gap between, each with its own width; it becomes an overlay under the breakpoint. Use the drawer slice (`apps/desktop/src/store/slices/drawer`) and `DrawerColumn`.
4. The breadcrumb is Up, the last crumb names the kind, and no chevron or back link sits on the page (R3, [navigation/session-rail.md](../navigation/session-rail.md) → Breadcrumbs).
5. One primary action per header; an overflow holds two or more actions.

## Test

A harness test for open, close and Esc; a scene probe for the geometry ([mock-scene.md](mock-scene.md)).

## Docs that move

[navigation.md](../navigation.md), [styling.md](../styling.md), the feature doc.

## Failure-mode rows that apply

Second window, late response, renamed `aria-label`.

## Guards

The frame map test, `no-layout-by-attribute`, the scene probe.
