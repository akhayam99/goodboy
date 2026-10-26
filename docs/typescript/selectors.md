# Store selectors

> **Read this when** you write a `useAppStore` call, a selector hook or a
> component that reads several store values. **Not for** the rules for store
> writes ([state-writes.md](state-writes.md)) or for memoizing a list row
> ([../../AGENTS.md](../../AGENTS.md) → Store selectors and memoization).

A selector decides when a component renders again. The store changes many
times a second while a turn streams, so a selector that reads too much costs
every window a render for every change.

## A whole-record key

A state key typed as a record keyed by an id is a **whole-record key**:
`sessionBranches`, `sessionMounts`, `agentTurnState`, `transcripts` and the
other `Readonly<Record<SessionId | AgentId | MountId | string, ...>>` keys
that the slice `state.ts` files declare. A component that subscribes to the
whole record renders again when any session, agent or mount in it changes,
even when the component shows one.

```ts
const branches = useAppStore((state) => state.sessionBranches);
const branch = useAppStore((state) => state.sessionBranches[sessionId]);
```

The first line renders for every session. The second renders when the branch
of this session changes. Write the second.

## The rules

1. Subscribe to the one entry you read: `state.sessionBranches[sessionId]`.
   When you need a few entries, select each, or select them together under
   `useShallow` with exactly the ids you need.
2. A selector that builds a new array, object or `Map` needs `useShallow`
   (`zustand/react/shallow`). `useShallow` does not make a whole-record
   subscription cheap: it stops a render loop, not a render per change.
3. The write-heavy keys (the lists of the transcripts,
   agents, project-mounts, sessions and scripts slices in `hotSliceKeys.ts` next to the guard) are never read whole.
   The guard fails on any such subscription and has no allowlist.
4. A component that reads eight or more store values groups them behind one
   model hook (a `use<Name>Model` hook next to the component), so the component reads one object and the
   hook owns the selectors.
5. The selector argument is called `state`, not `s` and not `store`. An older
   file keeps `s` until someone edits its selector; a new selector uses `state`.
6. There is no comment that opts a selector out. If the selector is stable,
   write it so the guard sees that; if it is not, fix it.

## The guards

`__tests__/regressions/no-unstable-zustand-selectors.test.ts` holds three:

- a selector that returns a fresh literal or ends in `.map`, `.filter` and the
  like, without `useShallow`, fails at once;
- a selector on a hot key (rule 3) fails at once;
- a selector on any other whole-record key may stay where it is today and may
  not appear anywhere else: `whole-record-selectors.baseline.json` counts
  them per file and only falls. The record keys are read from the `state.ts`
  and `types.ts` files of the store, so a new record key is covered the day
  it is declared, with no list to extend.

When you fix one, run the test with `GOODBOY_UPDATE_BASELINE=1` so the count
falls with it ([../ratchets.md](../ratchets.md)).
