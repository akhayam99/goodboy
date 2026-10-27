# Recipe: a store slice action

> **Read this when** you add or change a Zustand action. **Not for** the write
> rules themselves ([state-writes.md](../typescript/state-writes.md)).

## Steps

1. Pick the slice folder under `apps/desktop/src/store/slices/`. A new domain is a new folder with `index.ts`, `state.ts` and `types.ts`, never an addition to the monolith ([file-system.md](../file-system.md)).
2. One action per file, named for the verb (`setSessionBudget.ts`). The action is a closure over the store: `export const setSessionBudget = (set: SetFn, get: GetFn) => async ({ sessionId, limit }: Params) => ...`. The outer `(set, get)` keeps zustand's own signature (the callback exception in [components.md](../typescript/components.md)); the returned action takes one destructured `Params` object and names its target. That closure form is the canonical one. The older actions that take positional values (`updateReviewDraft(id, body)`) are legacy: convert one when you touch it, never copy it. A slice that reads no state takes only `set`.
3. Apply state only after the async step succeeded; on failure keep the old state and surface the error.
4. Register the action in the slice `index.ts` factory (`createXSlice = ({ set, get }: SliceDeps) => ({ ... })`). That is all the action needs: `AppStore` is the intersection of `ReturnType<typeof createXSlice>`, so no signature is written twice.

## Compose a new slice

A new slice touches these files, and only these:

1. `slices/<domain>/state.ts`: the state type and `<domain>InitialState`. Every state key lives here, never inline in `types.ts` or `store.ts`.
2. `slices/<domain>/index.ts`: `create<Domain>Slice = ({ set, get }: SliceDeps) => ({ ...actions })`.
3. `store/store.ts`: one import, one `ReturnType<typeof create<Domain>Slice>` line in `AppStore`, one `...<domain>InitialState` in `initialState`, one `...create<Domain>Slice({ set, get })` in the store.
4. `store/types.ts`: the state type in `AppSliceState`.
5. `store/sessionEviction.ts`, when a state key is keyed by session, agent or workflow run.

`store-state-keys-are-unique.test.ts` fails when two slices own one key or a key is written inline in `store.ts`, and `store-has-no-runtime-cycle.test.ts` fails when a file the store loads imports the store back. A slice never imports a hook or component file: pure helpers a slice needs sit in their own file next to the hook.

## Test

A real-store test through `storyHarness`, next to the action or in the slice `index.test.ts`. Assert the store after the click, after a failure and after a late answer ([testing.md](../testing.md)).

## Docs that move

The feature doc that owns the behavior ([feature-doc.md](feature-doc.md)), and [navigation.md](../navigation.md) when a verb or a surface changes.

## Failure-mode rows that apply

Target, when state changes, failure shown, retry and undo, second window, late response, number owner ([AGENTS.md](../../AGENTS.md) → Before you write code).

## Guards

`ambient-target`, `catch-swallow`, `store-mocks`, `param-shape`, `store-state-keys-are-unique`, `store-has-no-runtime-cycle` (`pnpm run check:rules`, `pnpm run check:baselines`).
