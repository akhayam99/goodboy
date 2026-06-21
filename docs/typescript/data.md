# Data & types

How data shapes are declared. Type naming and where types live (`Props`,
`Params`, shared types) are in [AGENTS.md](../../AGENTS.md) → Naming.

## `type`, never `interface`

Declare every object shape with `type`. `interface` is forbidden, no exceptions
(no `Props` interface, no declaration merging). One declaration style across the
codebase: `type` already covers unions, intersections, primitives, and object
shapes uniformly, so there is no reason to mix in `interface`.

```ts
// good
type Session = {
  id: string;
  title: string;
};

// bad
interface Session {
  id: string;
  title: string;
}
```

## Extension via intersection, never `extends`

```ts
// good
type RunningSession = Session & {
  startedAt: number;
};

// bad
interface RunningSession extends Session {
  startedAt: number;
}
```

## `satisfies` over `as` for const validation

Validate a literal against a type with `satisfies`, never `as`. `as` silences
the checker and lets a wrong shape through; `satisfies` checks the value against
the type while keeping the narrow literal type.

```ts
// good
const config = {
  retries: 3,
  timeout: 5000,
} satisfies RequestConfig;

// bad
const config = {
  retries: 3,
  timeout: 5000,
} as RequestConfig;
```

## Exhaustiveness with `never` in switch defaults

A `switch` over a union ends with a `default` that assigns the scrutinee to
`never`. When a new variant is added, the compiler flags every unhandled switch.

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

Model any value with mutually exclusive states as a discriminated union on a
literal tag, never a bag of optional fields. The owning deep-dive and the shared
domain unions live in `packages/types`.

```ts
type Fetch =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; data: Session }
  | { status: 'error'; message: string };
```

## Branded IDs

String IDs are branded so a `WorkspaceId` is not assignable to a `SessionId`.
The brand definitions and helpers are owned by `packages/types`; import them, do
not redeclare a brand locally.

```ts
type WorkspaceId = string & { __brand: 'WorkspaceId' };
```

## Where types live

Shared domain types live in their owning module (`packages/types/src/` for
cross-package, `shared/types/<name>.ts` for cross-feature). Types used by a single
component stay local to that file. See [file-system.md](../file-system.md) → Shared types
for the placement rules.
