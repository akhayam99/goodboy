# Components & exports

> **Read this when** writing a component's exports, props or ref pattern.
> **Not for** where the component's file goes (`docs/file-system.md`).

Component placement and folder layout: [file-system.md](../file-system.md) → Components.

## `export const`, never `export function`

React class components (error boundaries that require `class`) are the only exception. Named exports only, one export per file ([AGENTS.md](../../AGENTS.md) → Exports).

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

When a component grows past a single readable screen, it becomes a **folder**, and each visual region becomes its own sibling file.

The folder's **`index.tsx` is the component**: it holds the composer with the full JSX and the public `Props`. It is **not** a barrel that re-exports a sibling file. The atomic sub-components live as sibling files next to it, each with its own local `type Props`. The rule is **recursive**: a sub-component that outgrows a readable screen becomes a nested folder with its own `index.tsx`.

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

Functions never take positional parameters. They take one object, destructured at the signature. Components name its type `Props`; everything else uses `Params`. **The parameter type is always a named declaration, never an inline object literal in the signature.**

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
gives each function a disambiguated named type such as
`UpsertSessionParams`. Store action signatures declared together on a state
type use the same disambiguated form, such as
`setActive: (params: SetActiveParams) => void`. This is the complete naming
rule: use the shortest unambiguous name within the declaring module.

**The boundary: callbacks keep their imposed signature.** A callback whose signature is dictated by its caller stays positional: array iteratees, event handlers, `setTimeout`, zustand's `set`/`get`, component prop callbacks. Adapt at the wiring point: `onSelect={(id) => activate({ id })}`.

**No exemption for local or single-argument helpers.** Arity does not matter: the rule is about every signature reading the same way.

## No prop spreading without an explicit type

Never spread an untyped object into a component. Spread only a value whose type is declared, so the checker still knows every key.

## Loading and error feedback

Design law, not a component convention: [DESIGN.md](../../DESIGN.md) → Motion (skeletons, spinners forbidden) and → Status & signals (toasts, never pinned banners). `Skeleton` and the toast system live in `@goodboy/ui`.
