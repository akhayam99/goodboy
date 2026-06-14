# TypeScript style

How we write TypeScript across the monorepo. `AGENTS.md` owns file layout, naming,
and forbidden patterns and points here for the detail. These are rules, not
suggestions.

Goodboy is feature-first (`features/<domain>/`, see
[AGENTS.md](../AGENTS.md) → File system layout). The rules below are about
how each file reads, not how the tree is organized.

## Types

### `type`, never `interface`

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

### Extend via intersection, never `extends`

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

### Where types live

Shared domain types live in their owning module (`packages/types/src/` for
cross-package, `shared/types/<name>.ts` for cross-feature). Types used by a single
component stay local to that file. See `AGENTS.md` for the placement rules.

## Exports

### `export const` arrow, never `export function`

Export arrow functions bound to `const`. `export function` is forbidden.

```ts
// good
export const routeAgent = async ({ agent }: RouteAgentParams): Promise<void> => { ... }

// bad
export function routeAgent(agent: Agent): Promise<void> { ... }
```

React class components (error boundaries that require `class`) are the only
exception, since they cannot be expressed as an arrow.

Named exports only, one export per file. Both already covered in `AGENTS.md`.

## Function parameters

### Every function we declare takes one named object, always

Functions never take positional parameters. They take a single object, destructured
at the signature, typed by a named declaration. Components name the type `Props`;
everything else (hooks, store actions, domain, db, utilities) names it `Params` or a
per-function variant. The parameter type is always a named declaration, never an
inline object literal in the signature.

This holds even for single-argument local helpers. Arity does not buy an exemption:
the rule is that every signature reads the same way (`: Props` / `: Params`), not
only that ordering is unambiguous.

```ts
// good
type FormatCostParams = {
  cents: number
}

export const formatCost = ({ cents }: FormatCostParams): string => { ... }

// bad: positional, churns every call site on change
export const formatCost = (cents: number): string => { ... }

// bad: inline object literal, the shape has no name
export const formatCost = ({ cents }: { cents: number }): string => { ... }
```

A module exporting many functions gives each its own named type
(`UpsertSessionParams`, `RouteAgentParams`), since one `Params` cannot cover them
all. Store action signatures declared on the state type follow the same rule:
`setActive: (params: SetActiveParams) => void`, never an inline object.

### The boundary: callbacks keep their imposed signature

This applies to functions we declare. A callback whose signature is dictated by its
caller stays positional, because we do not control how it is invoked: array
iteratees (`sessions.map((session) => ...)`), event handlers, `setTimeout`, zustand's
`create((set, get) => ...)` and its `set` / `get`, and component prop callbacks
(`onSelect`, `onChange`). Where a `Params`-style function is wired to such a
callback, adapt at the wiring point: `onSelect={(id) => activate({ id })}`.

## Control flow

### Guard clauses, keep code left

Exit early instead of nesting the happy path. Handle the edge case first and return;
the rest of the function stays at the base indentation level.

### No `if/else`

`if/else` is forbidden. Return from the guard, then continue.

```ts
// good
const label = ({ count }: LabelParams): string => {
  if (count === 0) {
    return 'empty';
  }

  return `${count} items`;
};

// bad
const label = ({ count }: LabelParams): string => {
  if (count === 0) {
    return 'empty';
  } else {
    return `${count} items`;
  }
};
```

### No inline `if` body

Never write the body of an `if` on the same line. Always a brace block, even for a
single statement. Ternaries for value selection are fine; this targets `if`
statements.

```ts
// good
if (sessions.length === 0) {
  return null;
}

// bad
if (sessions.length === 0) return null;
```

### Branch the body with guards, not a top-level ternary

When a function's whole body chooses what to render, use guard clauses with early
returns, never a ternary as the function body. The guard form reads as a sequence of
cases and leaves room to grow.

```tsx
// good
export const StepView = ({ step }: Props) => {
  if (step === 1) {
    return <ProviderStep />;
  }

  return <WorkspaceStep />;
};

// bad
export const StepView = ({ step }: Props) => (step === 1 ? <ProviderStep /> : <WorkspaceStep />);
```

A ternary inside JSX that picks between two elements
(`{items.length === 0 ? <Empty /> : <List />}`) stays.

### Conditional rendering: `&&` for one element, ternary for two

Render one element with `cond && <X/>`. Reserve the ternary for when both branches
render. A `? <X/> : null` is `&&` with extra noise.

```tsx
// good
{
  isRunning && <CostBadge />;
}
{
  items.length === 0 ? <Empty /> : <List items={items} />;
}

// bad
{
  isRunning ? <CostBadge /> : null;
}
```

Never gate on a raw number: `{count && <X/>}` renders the text `0` when `count` is
`0`. Gate on a boolean: `count > 0 && <X/>`.

### Compare explicitly, never coerce

A condition names what it tests. Branching on a bare value leans on truthiness and
conflates distinct states: `if (url)` treats `null`, `''`, and a real URL as one
yes/no. Compare against the value you mean:

- nullable (`T | null`, `T | undefined`): `x != null` / `x == null`
- string with an empty sentinel: `x !== ''` / `x === ''`
- number: `x > 0` / `x === 0`

```tsx
// good
if (session == null) { ... }
{youtubeUrl != null && <Watch href={youtubeUrl} />}
const pool = candidates.length > 0 ? candidates : fallback

// bad
if (!session) { ... }
{youtubeUrl && <Watch href={youtubeUrl} />}
const pool = candidates.length ? candidates : fallback
```

Booleans are the exception: a `boolean` already is the condition, so use it directly
(`if (!open)`, `disabled={!isValid}`). Never inflate to `=== true`. Coalescing at a
data boundary (`raw ?? []`, `value || null`) normalizes rather than branches and
stays.

### Guard the short branch

When one branch is a one-liner and the other is verbose, invert so the short branch
returns from the guard and the verbose branch stays un-nested at the base level.

### Breathe between blocks

Separate a guard from the body that follows with a blank line, and group related
statements with blank lines between groups. The guard is one thought; the main path
is another.

## Readability

### Speaking names, never cryptic abbreviations

Variables, parameters, and callbacks name the thing they hold. No single-letter or
truncated names.

```ts
// good
const session = data.sessions?.[0];
agents.map((agent) => agent.id);

// bad
const s = data.sessions?.[0];
agents.map((a) => a.id);
```

The only short names kept on purpose: the event-handler arg `e` and the state
selector arg in store hooks. Everything holding domain data gets a full name.

### Zero comments

Comments are not used. Not WHAT, not WHY, not JSDoc. A comment that restates the code
is noise; if code needs a comment to be understood, rename until it speaks for
itself. The only thing left is required tooling directives
(`/// <reference />`), which are not comments.

```ts
// good: the guard reads for itself
if (fetchedAgent !== currentAgent) {
  return;
}

// bad: comment compensating for unclear code
if (a !== b) {
  return; // bail if the agent changed during the fetch
}
```
