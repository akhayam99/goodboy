# Control flow

Early return, no `if/else`, no inline `if`. The hard-rules summary and the
forbidden-patterns checklist live in [AGENTS.md](../../AGENTS.md) → Code rules.

## Guard clauses, keep code left

Exit early instead of nesting the happy path inside a conditional. Handle the
edge case first and return; the rest of the function stays at the base
indentation level.

## No `if/else`

`if/else` is banned. Return from the guard, then continue.

```ts
// good
const label = ({ count }: LabelParams): string => {
  if (count === 0) {
    return 'empty';
  }

  return `${count} items`;
};

// bad: if/else
const label = ({ count }: LabelParams): string => {
  if (count === 0) {
    return 'empty';
  } else {
    return `${count} items`;
  }
};
```

## No inline `if` body

Never write the body of an `if` on the same line. Always use a brace block, even
for a single statement.

```ts
// good
if (sessions.length === 0) {
  return null;
}

// bad: inline
if (sessions.length === 0) return null;
```

Ternaries for value selection are fine; this rule targets `if` statements.

## Branch the body with guards, not a top-level ternary

When a function's whole body chooses which element to render, use guard clauses
with early returns, never a ternary _as_ the function body. The `if`-return form
reads as a sequence of cases and leaves room to grow (a third branch, a log, a
hook call) without a rewrite.

```tsx
// good: guard clause, early return
export const StepView = ({ step }: Props) => {
  if (step === 1) {
    return <ProviderStep />;
  }

  return <WorkspaceStep />;
};

// bad: ternary standing in for the function body
export const StepView = ({ step }: Props) => (step === 1 ? <ProviderStep /> : <WorkspaceStep />);
```

This targets the _body_ level. A ternary _inside_ JSX that picks between two
elements (`{items.length === 0 ? <Empty /> : <List />}`) stays.

## Conditional rendering: `&&` for a single element

To render one element conditionally, use `cond && <X/>`. Reserve the ternary for
the case where _both_ branches render something (choosing A over B). A `? <X/> : null`
is the ternary doing the job of `&&` with extra noise.

```tsx
// good: single element, boolean guard
{
  isRunning && <CostBadge />;
}
{
  historyCount > 0 && <span>({historyCount})</span>;
}

// good: ternary because both branches render
{
  items.length === 0 ? <Empty /> : <List items={items} />;
}

// bad: ternary standing in for `&&`
{
  isRunning ? <CostBadge /> : null;
}
```

One footgun: never gate on a raw number. `{count && <X/>}` renders the text `0`
when `count` is `0` (React renders `0` and `NaN`, but skips `false`/`null`/`undefined`/`''`).
Gate on a boolean instead: `count > 0 && <X/>` or `!!count && <X/>`.

## Compare explicitly, never coerce

A condition must name what it tests. Branching on a bare value leans on
truthiness coercion and quietly conflates distinct states: `if (url)`
treats `null`, `''`, and a real URL as one yes/no. Compare against the value you
actually mean:

- nullable (`T | null`, `T | undefined`): `x != null` / `x == null`
- string with an empty sentinel: `x !== ''` / `x === ''`
- number: `x > 0` / `x === 0`

```tsx
// good: explicit
if (session == null) { ... }
{youtubeUrl != null && <Watch href={youtubeUrl} />}
const pool = candidates.length > 0 ? candidates : fallback

// bad: implicit coercion
if (!session) { ... }
{youtubeUrl && <Watch href={youtubeUrl} />}
const pool = candidates.length ? candidates : fallback
```

Booleans are the exception: a `boolean` already _is_ the condition, so use it
directly: `if (!open)`, `disabled={!isValid}`, `isRunning && <X/>`. Never
inflate one to `=== true`.

Coalescing at a data boundary (`raw ?? []`, `value || null`) normalizes a
value rather than branching on it: that idiom stays.

## Guard the short branch

When one branch is a one-liner and the other is verbose, invert the condition so
the short branch returns from the guard and the verbose branch stays un-nested at
the base level.

## Breathe between blocks

Separate a guard from the body that follows it with a blank line, and group
related statements with blank lines between groups. The guard is one thought; the
main path is another.

```ts
// good
const agent = data.agents?.[0];
if (agent == null) {
  throw new Error(`Agent ${id} not found`);
}

return toAgentDetail(agent);

// bad: guard glued to the body
const agent = data.agents?.[0];
if (agent == null) {
  throw new Error(`Agent ${id} not found`);
}
return toAgentDetail(agent);
```
