# Control flow

> **Read this when** structuring conditionals, branches or early returns in a
> function. **Not for** data-shape or component rules (see the sibling docs in
> `docs/typescript/`).

## Guard clauses, keep code left

Exit early instead of nesting the happy path inside a conditional. Handle the edge case first and return; the rest of the function stays at the base indentation level.

## No `if/else`, no inline `if` body

Return from the guard, then continue. Always a brace block, even for a single statement: no `else`, no `if (x) return y;` on one line.

## Branch the body with guards, not a top-level ternary

When a function's whole body chooses which element to render, use guard clauses with early returns, never a ternary as the function body.

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

This targets the body level. A ternary inside JSX that picks between two elements stays.

## Conditional rendering: `&&` for a single element

`cond && <X/>` for one element; ternary only when both branches render something. A `? <X/> : null` is the ternary doing the job of `&&` with extra noise.

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

Never gate on a raw number: `{count && <X/>}` renders the text `0` when `count` is `0`. Gate on a boolean: `count > 0 && <X/>` or `!!count && <X/>`.

## Compare explicitly, never coerce

A condition must name what it tests. `if (url)` treats `null`, `''`, and a real URL as one yes/no.

- nullable (`T | null`, `T | undefined`): `x != null` / `x == null`
- string with an empty sentinel: `x !== ''` / `x === ''`
- number: `x > 0` / `x === 0`

```tsx
// good
if (session == null) { ... }
const pool = candidates.length > 0 ? candidates : fallback

// bad
if (!session) { ... }
const pool = candidates.length ? candidates : fallback
```

Booleans are the exception: a `boolean` already is the condition, use it directly (`if (!open)`, `isRunning && <X/>`). Never inflate one to `=== true`. Coalescing at a data boundary (`raw ?? []`, `value || null`) normalizes a value rather than branching on it: that idiom stays.

## Guard the short branch

When one branch is a one-liner and the other is verbose, invert the condition so the short branch returns from the guard and the verbose branch stays un-nested.

## Breathe between blocks

Blank line between a guard and the body that follows it; group related statements with blank lines between groups.
