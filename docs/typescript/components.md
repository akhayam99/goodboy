# Components & exports

> **Read this when** writing a component's exports, props or ref pattern.
> **Not for** where the component's file goes (`docs/file-system.md`).

Component placement and folder layout: [file-system.md](../file-system.md) → Components.

## `export const`, never `export function`

React class components (error boundaries that require `class`) are the only exception. Named exports only. One export per file ([AGENTS.md](../../AGENTS.md) → Components and exports).

## React component patterns

- No `React.FC`. Function components with an explicit local `type Props`.
- `ref` is a plain prop (React 19). No `forwardRef`.
- Discriminated unions for variant props:
  ```ts
  type Props = { variant: 'primary'; tone?: 'default' | 'danger' } | { variant: 'ghost' };
  ```
- Default values via destructuring, not `defaultProps`.
- No `children: ReactNode` when a stricter type fits.
- `key` from stable domain IDs, never array index.

## Splitting a component into a folder

When a component grows past a single readable screen, it becomes a **folder**. Each visual region then becomes its own sibling file.

The folder's **`index.tsx` is the component**. It holds the composer, with the full JSX and the public `Props`. It is **not** a barrel that re-exports a sibling file. The atomic sub-components live as sibling files next to it, each with its own local `type Props`. The rule is **recursive**: a sub-component that outgrows a readable screen becomes a nested folder with its own `index.tsx`.

```
AgentCard/
  index.tsx        # the component itself: composes the slots below
  Header.tsx
  CostBadge.tsx
  Actions/         # a slot that itself splits: nested folder, same rule
    index.tsx
    Rename.tsx
    KindMenu.tsx
```

```tsx
// bad: index.tsx is an empty barrel, the component hides in a sibling
export { AgentCard } from './AgentCard';
```

Callers are unaffected: an import of `"./AgentCard"` resolves to the folder's `index.tsx`. Do not leave behind a redundant `AgentCard.tsx` alongside the folder. A sub-component reused outside the folder graduates to its own module under `components/`.

## Every function takes a single destructured object, always named

Functions never take positional parameters. They take one object, destructured at the signature. Components name its type `Props`. Everything else uses `Params`. **The parameter type is always a named declaration, never an inline object literal in the signature.**

```ts
// good: order-free, self-documenting, named
type Params = {
  target: ResetTarget
}

export const useResetTo = ({ target }: Params) => { ... }

// bad: positional; adding an argument churns every call site
export const useResetTo = (target: ResetTarget) => { ... }

// bad: inline object literal; the parameter shape has no name
export const useResetTo = ({ target }: { target: ResetTarget }) => { ... }
```

A single-export module uses `Params`. A module exporting multiple functions
gives each function its own named type, one that won't clash with the others,
such as `UpsertSessionParams`. Store action signatures on a state type follow
the same rule, for example
`setActive: (params: SetActiveParams) => void`. This is the complete naming
rule: use the shortest unambiguous name within the declaring module.

**The exception: callbacks keep the signature their caller gives them.** A callback stays positional when its caller decides the signature. Examples: array iteratees, event handlers, `setTimeout`, zustand's `set`/`get`, component prop callbacks. Adapt at the wiring point instead: `onSelect={(id) => activate({ id })}`.

**No exception for local or single-argument helpers.** It doesn't matter how many arguments a function takes: the rule is about every signature reading the same way.

## No prop spreading without an explicit type

Never spread an untyped object into a component. Spread only a value whose type is declared, so the checker still knows every key.

## Loading and error feedback

This is a design law, not a component convention. See [DESIGN.md](../../DESIGN.md) → Motion (skeletons and spinners are forbidden) and → Status & signals (use toasts, never pinned banners). `Skeleton` and the toast system live in `@goodboy/ui`.
