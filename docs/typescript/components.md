# Components & exports

How components and module exports are structured. Component placement and folder
layout live in [file-system.md](../file-system.md) → Components.

## `export const`, never `export function`

Export arrow functions bound to `const`. `export function` is forbidden.

```ts
// good
export const routeAgent = async ({ agent }: RouteAgentParams): Promise<void> => { ... }

// bad
export function routeAgent(agent: Agent): Promise<void> { ... }
```

React class components (error boundaries that require `class`) are the only
exception, since they cannot be expressed as an arrow.

Named exports only, one export per file. Both already covered in
[AGENTS.md](../../AGENTS.md) → Exports.

## Splitting a component into a folder

When a component grows past a single readable screen, it becomes a **folder**, and
each visual region becomes its own sibling file. A wall of nested JSX in one file
hides its structure; named slots make the composer read as a list of pieces.

The folder's **`index.tsx` _is_ the component**: it holds the composer with the
full JSX and the public `Props`. It is **not** a barrel that re-exports a sibling
file; an index that only forwards an export is pointless indirection. The atomic
sub-components live as sibling files next to it, each following the one-export
rule with its own local `type Props`.

```
AgentCard/
  index.tsx        # the component itself: composes the slots below
  Header.tsx       # agent kind badge + status indicator
  CostBadge.tsx    # live cost display
  Actions/         # a slot that itself splits: nested folder, same rule
    index.tsx      # the Actions component: composes sub-actions
    Rename.tsx     # inline rename control
    KindMenu.tsx   # kind label picker
```

The rule is **recursive**: when a sub-component itself grows past a readable
screen it becomes a folder under its parent, with its own `index.tsx` as the
component and its own siblings. `Actions/index.tsx` _is_ `Actions` exactly as
`AgentCard/index.tsx` _is_ `AgentCard`.

```tsx
// good: index.tsx carries the component
import { Header } from './Header';
import { Actions } from './Actions';

export const AgentCard = ({ agent, onRename, onKindChange }: Props) => (
  <article>
    <Header kind={agent.kind} status={agent.status} />
    <CostBadge cents={agent.cost} />
    <Actions onRename={onRename} onKindChange={onKindChange} />
  </article>
);

// bad: index.tsx is an empty barrel, the component hides in a sibling
export { AgentCard } from './AgentCard';
```

Callers are unaffected: an import of `"./AgentCard"` resolves to the folder's
`index.tsx`, so splitting a flat component into a folder touches no call site.
Do not leave behind a redundant `AgentCard.tsx` alongside the folder. A
sub-component reused outside the folder graduates to its own module under
`components/`.

See [file-system.md](../file-system.md) → Components for the full placement rules
(flat vs. folder, test co-location, when to flatten).

## Props typing

Type props with a local `type Props` (see [data](./data.md)):

```ts
type Props = {
  agent: Agent
  onKindChange: () => void
}

export const AgentCard = ({ agent, onKindChange }: Props) => { ... }
```

## Every function takes a single destructured object, always named

Functions never take positional parameters. They take one object, destructured
at the signature. Components name its type `Props`; everything else (hooks,
domain, api, storage, store actions) uses `Params`. **The parameter type
is always a named declaration, never an inline object literal in the
signature.**

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

A module with a single such function (a hook, a standalone util) names the type
`Params`. A module exporting many functions gives **each function its own named
type** (`UpsertSessionParams`, `RouteAgentParams`), since one `Params` type
cannot cover them all. Store action signatures declared on the state type follow
the same rule: `setActive: (params: SetActiveParams) => void`, not an inline
object.

**The boundary: callbacks keep their imposed signature.** This applies to the
functions _we_ declare. A callback whose signature is dictated by its caller
stays positional, because we do not control how it is invoked: array iteratees
(`sessions.map((session) => ...)`), event handlers, `setTimeout`, zustand's
`create((set, get) => ...)` and its `set`/`get`, and component prop callbacks
(`onSelect`, `onChange`). Where a `Params`-style function is wired to such a
callback, adapt at the wiring point: `onSelect={(id) => activate({ id })}`.

**No exemption for local or single-argument helpers.** A helper _we_ declare
takes a named object even when it lives inside a component and takes a single
argument. Arity does not matter: the rule is about every signature reading the
same way (`: Params`), not only about ordering ambiguity.

## No prop spreading without an explicit type

Never spread an untyped object into a component (`<Card {...props} />` where
`props` is loosely typed). Spreading hides which props a component receives and
lets unexpected attributes through. Spread only a value whose type is declared,
so the checker still knows every key.

## Loading states: skeletons, not spinners

A component that renders a card or any substantial graphical element gets a
**skeleton** for its loading state, never a bare spinner. The skeleton is a
greyed placeholder that mirrors the real layout (image block, title bar, chips,
buttons) so the page does not jump when content arrives and the user sees the
shape of what is coming.

```tsx
// good: placeholder mirrors the card it replaces
<AgentCardSkeleton />

// bad: a spinner over a card-shaped hole
<Spinner />
```

A spinner is acceptable only for the _first_ load of an empty region where there
is no shape to mirror yet. The moment a component is worth skeletonizing,
skeletonize it.

**The skeleton mirrors its component: keep them in sync.** A skeleton is a copy
of the component's structure frozen in grey. When you change the component's
layout (add a band, move a row, resize a button), update its skeleton in the
**same change**. A skeleton that no longer matches its component is a layout-jump
bug waiting to happen. Treat the skeleton as part of the component's definition,
not a separate artifact.

See [DESIGN.md](../../DESIGN.md) → Components & interaction for the design
principle behind this rule.

## Error feedback: toasts, not inline banners

Every error surfaces as a **toast**, a transient, dismissible notification,
never a persistent inline banner.

An inline banner sticks around after the condition that caused it is gone. A
"couldn't route the agent, try again" banner stays on screen even once the next
attempt succeeds, and the user cannot clear it. A toast is owned by the
notification system: it auto-dismisses, can be dismissed manually, and never
leaves stale error state wired into the view.

```tsx
// good: fire and forget; the toast system owns its lifecycle
toast.error("Couldn't route the agent. Try again.");

// bad: error state pinned into the view, cannot be cleared
{
  error && <div className="banner">{error}</div>;
}
```

Applies to all error alerts without exception.

See [DESIGN.md](../../DESIGN.md) → Status & signals for the design principle
behind this rule.
