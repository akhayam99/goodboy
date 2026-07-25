# @goodboy/ui

Shared React 19 components for Goodboy. Presentational primitives styled with Tailwind CSS v4.

No business logic, no Tauri APIs, no data fetching.

Dark is the default theme, light is fully supported. Components carry no `dark:`
variants: both themes resolve through the semantic tokens in
`apps/desktop/src/styles.css`, which the light palette overrides under
`html[data-theme='light']`. Style against the tokens and a component themes
itself.

## Conventions

See [CONVENTIONS.md](./CONVENTIONS.md).

## Primitives

`src/index.ts` is the catalogue: every primitive and its props type is exported
there, one component per file under `src/components/`. Read the barrel instead of
a list here, which rots on the next addition.

Three exports are not a choice:

- `ScrollFade` wraps every scroll region. A bare `overflow-y-auto` is a bug. The
  header sits outside the fade ([docs/styling.md](../../docs/styling.md)).
- `Divider` separates regions, rendered as a sibling. A `border-t/-r/-b/-l` on a
  container to divide regions is a bug ([docs/styling.md](../../docs/styling.md)).
- `tintClasses(tone)` resolves every semantic tone. A per-file tone map is a bug
  ([DESIGN.md](../../DESIGN.md)).

`AppShell` is the app skeleton and the exception to "presentational only": it
owns the resizable sidebar widths, the collapse rails, and the single overlay
slot. What each pane is for lives in [DESIGN.md](../../DESIGN.md).

## Helper

### cn

Class-merging helper. `clsx` + `tailwind-merge`.

```tsx
import { cn } from '@goodboy/ui';

<span className={cn('text-sm', isActive && 'font-medium')} />;
```

## Design tokens

All tokens live in `apps/desktop/src/styles.css` under `@theme`. Reference them via Tailwind utilities.

### Font scale

| Token         | Value | Utility     |
| ------------- | ----- | ----------- |
| `--text-2xs`  | 10px  | `text-2xs`  |
| `--text-xs`   | 11px  | `text-xs`   |
| `--text-sm`   | 13px  | `text-sm`   |
| `--text-base` | 14px  | `text-base` |
| `--text-lg`   | 16px  | `text-lg`   |

`text-2xs` and `text-xs` replace ad-hoc `text-[10px]` / `text-[11px]` usage. `text-xs` was already 11px in this project (not Tailwind's default 13px), so there is no regression.

### Motion durations

| Token             | Value | Use                                             |
| ----------------- | ----- | ----------------------------------------------- |
| `--motion-fast`   | 100ms | micro-interactions (icon swap, badge)           |
| `--motion-normal` | 200ms | standard transitions (hover, open)              |
| `--motion-slow`   | 350ms | large surface transitions (panel slide, dialog) |

Easings:

| Token               | Value                          |
| ------------------- | ------------------------------ |
| `--ease-default`    | `cubic-bezier(0.4, 0, 0.2, 1)` |
| `--ease-emphasized` | `cubic-bezier(0.2, 0, 0, 1)`   |

### Motion policy

All animation and transition classes **must** be gated with the `motion-safe:` Tailwind prefix. This respects `prefers-reduced-motion: reduce`.

```tsx
// correct
<div className="motion-safe:transition-opacity motion-safe:duration-[--motion-normal]" />

// wrong: plays regardless of OS accessibility setting
<div className="transition-opacity duration-200" />
```

Rule: no bare `transition-*`, `animate-*`, or `duration-*` class without `motion-safe:` prefix. Nothing enforces it: the repo has no eslint config, and the pre-commit hook runs prettier only. Review catches this or it ships.

### Focus ring

`--color-focus-ring` is `oklch(0.55 0.18 265 / 0.55)`: primary hue at 55% opacity. Sufficient contrast on both white and muted backgrounds. Used automatically by the global `:focus-visible` rule.
