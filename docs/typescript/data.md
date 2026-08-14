# Data & types

> **Read this when** declaring a type or data shape. **Not for** naming or
> where the type lives (`AGENTS.md` → Naming, `docs/file-system.md`).

How data shapes are declared. Type naming and placement: [AGENTS.md](../../AGENTS.md) → Naming, [file-system.md](../file-system.md) → Shared types.

## `type`, never `interface`

Every object shape is a `type`. `interface` is forbidden, no exceptions (no declaration merging). `type` already covers unions, intersections, primitives, and object shapes uniformly. Extension via intersection, never `extends`: `type RunningSession = Session & { startedAt: number }`.

## `satisfies` over `as` for const validation

`as` silences the checker and lets a wrong shape through; `satisfies` checks the value while keeping the narrow literal type: `const config = { retries: 3, timeout: 5000 } satisfies RequestConfig`.

## Exhaustiveness with `never` in switch defaults

A `switch` over a union ends with a `default` that assigns the scrutinee to `never`, so a new variant flags every unhandled switch.

```ts
const label = (s: SessionStage): string => {
  switch (s) {
    case 'running':
      return 'Running';
    case 'done':
      return 'Done';
    default: {
      const _exhaustive: never = s;
      return _exhaustive;
    }
  }
};
```

## Discriminated unions for state machines

Model any value with mutually exclusive states as a discriminated union on a literal tag, never a bag of optional fields.

```ts
type Fetch =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; data: Session }
  | { status: 'error'; message: string };
```

## Branded IDs

String IDs are branded so a `WorkspaceId` is not assignable to a `SessionId`. The brand definitions and helpers are owned by `packages/types`; import them, do not redeclare a brand locally.
