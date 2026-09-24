# Control flow

> **Read this when** structuring conditionals, branches or early returns in a
> function. **Not for** data-shape or component rules (see the sibling docs in
> `docs/typescript/`).

## Guard clauses, keep code left

Exit early instead of nesting the happy path (the normal flow, with no errors) inside a conditional. Handle the edge case first and return. The rest of the function then stays at the base indentation level.

## No `if/else`, no inline `if` body

Return from the guard, then continue. Always use a brace block, even for a single statement. Never use `else`, and never write `if (x) return y;` on one line.

## Branch the body with guards, not a top-level ternary

When a function's whole body chooses which element to render, use guard clauses with early returns. Never use a ternary as the function body.

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

Use `cond && <X/>` for one element. Use a ternary only when both branches render something. A `? <X/> : null` is a ternary doing the job of `&&`, with extra noise.

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

Booleans are the exception. A `boolean` already is the condition, so use it directly (`if (!open)`, `isRunning && <X/>`). Never inflate one to `=== true`. One more exception: coalescing (using `??` or `||` to fall back to a default) at a data boundary, like `raw ?? []` or `value || null`. That normalizes a value rather than branching on it, so the pattern stays.

## Guard the short branch

When one branch is a one-liner and the other is verbose, invert the condition. The short branch then returns from the guard, and the verbose branch stays un-nested.

## Breathe between blocks

Leave a blank line between a guard and the body that follows it. Group related statements together, with a blank line between groups.
