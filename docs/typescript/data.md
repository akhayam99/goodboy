# Data & types

> **Read this when** declaring a type or data shape, or reading input you do not
> control. **Not for** naming or
> where the type lives (`AGENTS.md` → Naming, `docs/file-system.md`).

This page covers how we declare data shapes. For type naming and placement, see [AGENTS.md](../../AGENTS.md) → Naming and [file-system.md](../file-system.md) → Shared types.

## `type`, never `interface`

Every object shape is a `type`. `interface` is forbidden, no exceptions, because it allows declaration merging, and we don't want that. `type` already covers unions, intersections, primitives, and object shapes, all in one uniform way. Extend types with an intersection, never with `extends`: `type RunningSession = Session & { startedAt: number }`.

## `satisfies` over `as` for const validation

`as` silences the checker, so a wrong shape can slip through. `satisfies` checks the value but keeps its narrow literal type. For example: `const config = { retries: 3, timeout: 5000 } satisfies RequestConfig`.

## Exhaustiveness with `never` in switch defaults

A `switch` over a union should end with a `default` case that assigns the switched value to `never`. That way, adding a new variant flags every switch that doesn't handle it yet.

```ts
type Params = {
  readonly stage: SessionStage;
};

const stageLabel = ({ stage }: Params): string => {
  switch (stage) {
    case 'running':
      return 'Running';
    case 'done':
      return 'Done';
    default: {
      const _exhaustive: never = stage;
      return _exhaustive;
    }
  }
};
```

## Discriminated unions for state machines

Model any value that has mutually exclusive states as a discriminated union on a literal tag. Never model it as a bag of optional fields.

```ts
type Fetch =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; data: Session }
  | { status: 'error'; message: string };
```

## Branded IDs

String IDs are branded, so a `WorkspaceId` is not assignable to a `SessionId`. The brand definitions and helpers live in `packages/types`. Import them. Do not redeclare a brand locally.

## Untrusted input

Text from a user, a provider, a host, a file or a branch name is hostile until a check says otherwise.

- No adjacent unbounded quantifiers on input (`\s*\s*`, `\w+\w*`, `(a+)+`). Read by index, or split the match into two steps.
- No dispatch on a user key: never `handlers[input]()`. Look the key up in an explicit `Map` or check it with `Object.hasOwn` first.
- No regex sanitizing: never clean a string with `replace` and send it on to a path, a command or SQL. Accept what an allow list names, reject the rest.
- Cap the length at the boundary, before any parse, and return `null` or a typed error for what does not fit.
- Slugs, branch names, CLI versions and commit links go through the shared helper. Do not write a second one.
- Every exported `parse`, `slug`, `sanitize`, `normalize` or `strip` helper in `packages/core/src` must stay under 200ms on 100k hostile characters (`hostile-input.perf.test.ts`).
