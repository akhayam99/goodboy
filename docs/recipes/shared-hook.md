# Recipe: a shared hook or utility

> **Read this when** code is reused across features. **Not for** code for one
> feature (it stays in `features/<domain>/`).

## Steps

1. Decide the home with the line in [file-system.md](../file-system.md): `apps/desktop/src/shared/` for desktop, `packages/core` for logic with no React.
2. A hook is a folder `useFoo/index.ts`, even alone. Parameters are one destructured `Params` object.
3. A utility lives in `apps/desktop/src/shared/utils/` or next to its owner when one domain uses it.
4. Import from the file that defines it, never from a barrel.
5. Move the callers in the same change; leave no second copy.

## Test

A test beside the hook or utility: `renderHook` for a hook, plain calls for a utility. Cover empty, out of range and late input.

## Docs that move

[file-system.md](../file-system.md) when the line moves, the doc that owns the behavior.

## Failure-mode rows that apply

Number owner (one function computes it), late response.

## Guards

`hook-folder`, `param-shape`, `export-default`, `knip:production`.
