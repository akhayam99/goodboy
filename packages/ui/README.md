# @goodboy/ui

Shared React 19 components for Goodboy. Presentational primitives styled with Tailwind CSS v4.

No business logic, no Tauri APIs, no data fetching. Light mode only for now.

## Conventions

See [CONVENTIONS.md](./CONVENTIONS.md).

## Primitives

### Button

```tsx
import { Button } from '@goodboy/ui';

<Button onClick={handleClick}>save</Button>
<Button variant="secondary">cancel</Button>
<Button variant="ghost" size="sm">…</Button>
<Button variant="danger" disabled>delete</Button>
```

Variants: `primary` (default), `secondary`, `ghost`, `danger`. Sizes: `sm`, `md`.

### Input

```tsx
import { Input } from '@goodboy/ui';

<Input placeholder="search" value={q} onChange={(e) => setQ(e.target.value)} />;
```

### Textarea

```tsx
import { Textarea } from '@goodboy/ui';

<Textarea rows={4} placeholder="goal" />;
```

### ScrollArea

```tsx
import { ScrollArea } from '@goodboy/ui';

<ScrollArea className="h-64">{longList}</ScrollArea>;
```

### Collapsible

```tsx
import { Collapsible } from '@goodboy/ui';

<Collapsible open={open} onOpenChange={setOpen} trigger="files touched">
  <ul>{...}</ul>
</Collapsible>
```

### Dialog

Wraps native `<dialog>`. Esc closes; backdrop click does not.

```tsx
import { Dialog } from '@goodboy/ui';

<Dialog open={open} onClose={close} title="confirm">
  <p>are you sure?</p>
  <Button onClick={confirm}>yes</Button>
</Dialog>;
```

### KbdPill

```tsx
import { KbdPill } from '@goodboy/ui';

press <KbdPill>⌘K</KbdPill> to open
```

### AppShell

Three-pane layout: header on top, left sidebar, main, right sidebar. Each pane scrolls independently.

```tsx
import { AppShell } from '@goodboy/ui';

<AppShell
  header={<TopBar />}
  leftSidebar={<Sessions />}
  main={<Chat />}
  rightSidebar={<Context />}
/>;
```

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

`text-2xs` and `text-xs` replace ad-hoc `text-[10px]` / `text-[11px]` usage. `text-xs` was already 11px in this project (not Tailwind's default 13px) - no regression.

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

// wrong - plays regardless of OS accessibility setting
<div className="transition-opacity duration-200" />
```

Rule: no bare `transition-*`, `animate-*`, or `duration-*` class without `motion-safe:` prefix. A lint rule will enforce this post-P2.

### Focus ring

`--color-focus-ring` is `oklch(0.55 0.18 265 / 0.55)` - primary hue at 55% opacity. Sufficient contrast on both white and muted backgrounds. Used automatically by the global `:focus-visible` rule.
