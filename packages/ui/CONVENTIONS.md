# Conventions: @goodboy/ui

> **Read this when** you're writing code inside `@goodboy/ui` and need to know what belongs in this package. **Not for** process rules for the whole repo (`CONVENTIONS.md`) or general component style (`docs/typescript/components.md`).

The shared React component library. **Presentational only**: components here only draw what they are given. No business logic, no Tauri APIs, no data fetching, no global state.

## What does NOT belong here

- Business logic → `@goodboy/core`.
- Tauri bindings or `@tauri-apps/*` imports, global state (Zustand), routes, and shells that know the domain → `apps/desktop`.
- Data fetching, mutations, async I/O.
- Components tied to one domain (e.g. `<ProviderCard>`). Keep components generic and wire them up in the app.

## Component patterns

Owned by [docs/typescript/components.md](../../docs/typescript/components.md). Additions for this package:

- Extend native props with `React.ComponentProps<'button'>` (or the matching element). Avoid `React.HTMLAttributes` unless you mean it.
- No CVA. No Radix yet (add it later if accessibility needs justify it).

## Styling rules

- Tailwind utilities only. No `@apply`, no CSS modules, no custom CSS files (the app owns `styles.css`). Inline `style` only for values computed at runtime.
- Tokens come from the app's `@theme` block. Use them through Tailwind utilities,
  never as hardcoded hex. Theme rules that never change live in [DESIGN.md](../../DESIGN.md).
- Build conditional classes with `cn()` (`clsx` + `tailwind-merge`). Always merge the `className` prop last, so callers can override:
  ```ts
  className={cn('rounded px-3 py-2', isActive && 'bg-primary text-white', className)}
  ```

## Testing

Rules live in [docs/testing.md](../../docs/testing.md). No snapshot tests.

## Public API

- One root `src/index.ts` that re-exports everything. No barrel files inside subfolders.
- Every export is a named binding with a stable identifier.
