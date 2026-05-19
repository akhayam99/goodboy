# Conventions — @kay-am/ui

Shared React 19 component library. **Presentational only.** No business logic, no Tauri APIs, no data fetching, no global state.

## Scope

- Reusable presentational components (buttons, inputs, dialogs, layouts).
- Primitives composed via Tailwind utility classes.
- The `cn()` class-merging helper.
- Typed prop interfaces for visual variants.

## What does NOT belong here

- Business logic → `@kay-am/core`.
- Tauri command bindings or `@tauri-apps/*` imports → `apps/desktop`.
- Data fetching, mutations, async I/O.
- Global state (Zustand stores) → `apps/desktop`.
- Route-level components, page shells → `apps/desktop`.
- Domain-specific composites (e.g. `<ProviderCard>`). Keep primitives generic; the app wires them.
- Domain markup logic (e.g. rendering `<<ctx-*>>` tags). The current `Markdown` component is a temporary exception — it owns kay-am-specific tag rendering and is queued to move into `apps/desktop/src/shared/components/` or accept a tag-registry prop.

## Stack

- React 19. No `React.FC`. No `forwardRef` — `ref` is a regular prop in 19.
- Tailwind CSS v4. Utility-first, never `@apply`.
- `clsx` + `tailwind-merge` via `cn()` for conditional classes.
- No CVA. No Radix yet.

## Component patterns

- Function components only. Named exports:

  ```ts
  export function Button(props: ButtonProps) { ... }
  ```

- Props typed as `interface` or `type`. **Never inline.** Always exported with the same name (`ButtonProps`, `DialogProps`, `MarkdownProps`).
- Extend native props with `React.ComponentProps<'button'>` (or the relevant element). Avoid `React.HTMLAttributes` unless intentional.
- Discriminated unions for variants:

  ```ts
  type ButtonProps = { variant: 'primary'; tone?: 'default' | 'danger' } | { variant: 'ghost' };
  ```

- `ref` is a plain prop. No `forwardRef`.
- No prop spreading without an explicit type. Always `{...rest}: Props`.
- Default values via destructuring, not `defaultProps`.

## Accessibility

- Every interactive component carries appropriate ARIA. Specifically:
  - `Tooltip`: tooltip span has a stable `id`; the trigger wrapper carries `aria-describedby` while the tooltip is visible.
  - `Dialog`: native `<dialog>` + `aria-modal="true"` + `aria-labelledby` / `aria-describedby` wired to the header.
  - `Collapsible`: button carries `aria-expanded` and `aria-controls` referencing the content region.
  - `Select`: wraps native `<select>` — inherits browser a11y.
- Don't rely on host element semantics alone — make associations explicit via `useId`.

## Styling rules

- Tailwind utilities only. No CSS modules, no inline `style` except for runtime-computed values (e.g. dynamic grid dimensions).
- No `@apply`. No bespoke CSS files (the app owns `styles.css`).
- Conditional classes via `cn()`. Caller's `className` merged last so they can override.
- Light mode only for now. No `dark:` variants until dark mode lands.
- Tokens come from the app's `@theme` block (CSS variables). Reference via Tailwind utilities, never hardcoded hex.

## Product-agnostic API

A UI primitive **must not** carry product-specific constants. Persisted state keys, copy strings, and domain identifiers go in via props.

```ts
// good
<AppShell leftWidthStorageKey="kay-am:left-sidebar-width" ... />

// bad — couples the package to the product
const LEFT_KEY = 'kay-am:left-sidebar-width';
```

## Naming & files

- Components: PascalCase. One per file. File matches component name (`Button.tsx`).
- Hooks: `use<Name>` camelCase. File: `use-name.ts`.
- Utilities: kebab-case (`cn.ts`, `format-label.ts`).
- No barrel files inside subfolders. Single root `src/index.ts` re-export.

## Public API

`src/index.ts` re-exports every component AND its Props type. A missing Props type export is a bug — every component must surface `<Name>Props`.

## Folder structure

```
src/
├── index.ts              # public API (re-exports only)
├── cn.ts                 # class-merging helper
├── components/
│   ├── AppShell.tsx
│   ├── Button.tsx
│   ├── Collapsible.tsx
│   ├── CopyButton.tsx
│   ├── Dialog.tsx
│   ├── Input.tsx
│   ├── KbdPill.tsx
│   ├── Markdown.tsx       # see "What does NOT belong here" note
│   ├── ScrollArea.tsx
│   ├── Select.tsx
│   ├── Skeleton.tsx
│   ├── Textarea.tsx
│   └── Tooltip.tsx
└── __tests__/             # colocated tests will move here per ADR-0005
```

## Testing

- Vitest + `@testing-library/react` + `happy-dom`.
- Test rendering, accessibility roles, user interactions. Not implementation details.
- No snapshot tests.
- Naming: `<Component>.test.tsx` colocated with source.

## Code rules

- No `any`.
- No default exports.
- No prop spreading without explicit type.
- No comments unless explaining **why**.
