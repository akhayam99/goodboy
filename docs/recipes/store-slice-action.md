# Recipe: a store slice action

> **Read this when** you add or change a Zustand action. **Not for** the write
> rules themselves ([state-writes.md](../typescript/state-writes.md)).

## Steps

1. Pick the slice folder under `apps/desktop/src/store/slices/`. A new domain is a new folder with `index.ts`, `state.ts` and `types.ts`, never an addition to the monolith ([file-system.md](../file-system.md)).
2. One action per file, named for the verb (`setSessionBudget.ts`). It takes one destructured `Params` object and names its target.
3. Apply state only after the async step succeeded; on failure keep the old state and surface the error.
4. Register the action in the slice `index.ts`.

## Test

A real-store test through `storyHarness`, next to the action or in the slice `index.test.ts`. Assert the store after the click, after a failure and after a late answer ([testing.md](../testing.md)).

## Docs that move

The feature doc that owns the behavior ([feature-doc.md](feature-doc.md)), and [navigation.md](../navigation.md) when a verb or a surface changes.

## Failure-mode rows that apply

Target, when state changes, failure shown, retry and undo, second window, late response, number owner ([AGENTS.md](../../AGENTS.md) → Before you write code).

## Guards

`ambient-target`, `catch-swallow`, `store-mocks`, `inline-object-param` (`pnpm run check:rules`, `pnpm run check:baselines`).
