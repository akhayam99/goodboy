# Recipe: a mock scene

> **Read this when** a surface needs a screenshot or a mount proof. **Not for**
> behavior (that is a harness test, [testing.md](../testing.md)).

## The one way

1. Add `apps/desktop/src/app/components/MockScene/scenes/u24/<unit>.tsx` exporting `U24_<UNIT>_SCENES`, a map of scene id to component. The registry globs `scenes/u*/*.tsx`.
2. Render the real production component. Seed through the real store; every instant comes from `sceneClock` (`apps/desktop/src/app/components/MockScene/sceneClock.ts`).
3. Add a twin `<unit>.test.tsx` that mounts each scene and, for clickable writes, clicks the real controls.
4. Regenerate the list: `GOODBOY_UPDATE_BASELINE=1 pnpm --filter @goodboy/desktop exec vitest run src/app/components/MockScene/scenes.registry.test.tsx`. The diff of `scenes.txt` holds only your ids.
5. Names in seeds are mock names only (Harborline, Northwind, Acme).

## Test

The twin, the registry test, and the accessibility suite that mounts every scene in both themes.

## Docs that move

[mock-screenshots.md](../mock-screenshots.md) when a gotcha is new.

## Failure-mode rows that apply

Not applicable: a scene proves a mount, not a write.

## Guards

`scenes.registry.test.tsx` (duplicate ids, the sorted list), `scenes.test.tsx`, the scene probe `scripts/validate-scenes.mjs` (a menu has at least two rows).
