# Conventions: @goodboy/ui

Shared React 19 component library. **Presentational only.** No business logic, no Tauri APIs, no data fetching, no global state.

## Scope

- Reusable presentational components (buttons, inputs, dialogs, layouts).
- Primitives composed via Tailwind utility classes.
- The `cn()` class-merging helper.
- Typed prop interfaces for visual variants.
- Shared icon wrappers, if/when added.

## What does NOT belong here

- Business logic → `@goodboy/core`.
- Tauri command bindings or `@tauri-apps/*` imports → `apps/desktop`.
- Data fetching, mutations, async I/O.
- Global state (Zustand stores) → `apps/desktop`.
- Route-level components, page shells → `apps/desktop`.
- Domain-specific composites (e.g. `<ProviderCard>`). Keep generic, wire up at the app.

## Stack

- React 19. No `React.FC`. No `forwardRef`: `ref` is a regular prop in 19.
- Tailwind CSS v4. Utility-first, never `@apply`.
- `clsx` + `tailwind-merge` via `cn()` for conditional classes.
- No CVA. No Radix yet (add later if accessibility needs justify it).

## Component patterns

- Function components only, named `export const` arrows (hub forbids `export function`).
  ```ts
  export const Button = (props: ButtonProps) => { ... }
  ```
- Props typed as `type`, never `interface` (hub rule). Never inline.
- Extend native props with `React.ComponentProps<'button'>` (or the relevant element). Avoid `React.HTMLAttributes` unless intentional.
- Discriminated unions for variants:
  ```ts
  type ButtonProps = { variant: 'primary'; tone?: 'default' | 'danger' } | { variant: 'ghost' };
  ```
- `ref` is a plain prop. No `forwardRef`.
- No prop spreading without an explicit type. Always `{...rest}: ButtonProps`.
- Default values via destructuring, not `defaultProps`.
- No `children: ReactNode` when a stricter type fits.

## Styling rules

- Tailwind utilities only. No CSS modules, no inline `style` except for runtime-computed values (e.g. dynamic dimensions).
- No `@apply`. No bespoke CSS files (the app owns `styles.css`).
- Conditional classes via `cn()`:
  ```ts
  className={cn('rounded px-3 py-2', isActive && 'bg-primary text-white', className)}
  ```
- Always merge a `className` prop last → callers can override.
- Light mode only for now. No `dark:` variants until dark mode lands.
- Tokens come from the app's `@theme` block (CSS variables). Reference via Tailwind utilities, never hardcoded hex.

## Naming & files

- Components: PascalCase. One component per file. File matches component name (`Button.tsx`).
- Hooks: `use<Name>` camelCase. File: `use-name.ts`.
- Utilities: kebab-case (`cn.ts`, `format-label.ts`).
- Folders: kebab-case.
- No barrel files inside subfolders. Single root `src/index.ts` re-export.

## Folder structure

```
src/
├── index.ts              # public API (re-exports only)
├── cn.ts                 # class-merging helper
├── components/
│   ├── Button.tsx
│   ├── Input.tsx
│   └── Dialog.tsx
└── hooks/
    └── use-controllable.ts
```

## Testing

- Vitest + `@testing-library/react` + `happy-dom`.
- Test rendering, accessibility roles, user interactions. Not implementation details.
- No snapshot tests.
- Naming: `<Component>.test.tsx` colocated with source.
- Set up via `vitest.config.ts` with `environment: 'happy-dom'`.

## Public API

- `src/index.ts` re-exports only. No default exports.
- Every export is a named binding with a stable identifier.
