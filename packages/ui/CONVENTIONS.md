# Conventions: @goodboy/ui

> **Read this when** you're writing code inside `@goodboy/ui` and need this package's boundaries. **Not for** repo-wide process rules (`CONVENTIONS.md`) or general component style (`docs/typescript/components.md`).

Shared React component library. **Presentational only.** No business logic, no Tauri APIs, no data fetching, no global state.

## What does NOT belong here

- Business logic → `@goodboy/core`.
- Tauri bindings or `@tauri-apps/*` imports, global state (Zustand), routes, and domain-aware shells → `apps/desktop`.
- Data fetching, mutations, async I/O.
- Domain-specific composites (e.g. `<ProviderCard>`). Keep generic, wire up at the app.

## Component patterns

Owned by [docs/typescript/components.md](../../docs/typescript/components.md). Package-specific additions:

- Extend native props with `React.ComponentProps<'button'>` (or the relevant element). Avoid `React.HTMLAttributes` unless intentional.
- No CVA. No Radix yet (add later if accessibility needs justify it).

## Styling rules

- Tailwind utilities only. No `@apply`, no CSS modules, no bespoke CSS files (the app owns `styles.css`). Inline `style` only for runtime-computed values.
- Tokens come from the app's `@theme` block. Reference via Tailwind utilities,
  never hardcoded hex. Theme invariants live in [DESIGN.md](../../DESIGN.md).
- Conditional classes via `cn()` (`clsx` + `tailwind-merge`), always merging the `className` prop last so callers can override:
  ```ts
  className={cn('rounded px-3 py-2', isActive && 'bg-primary text-white', className)}
  ```

## Testing

Rules in [docs/testing.md](../../docs/testing.md). No snapshot tests.

## Public API

- Single root `src/index.ts` re-export, no barrel files inside subfolders.
- Every export is a named binding with a stable identifier.
