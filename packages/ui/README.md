# @kay-am/ui

Shared React 19 components for kAY.am. Presentational primitives styled with Tailwind CSS v4.

No business logic, no Tauri APIs, no data fetching. Light mode only for now.

## Conventions

See [CONVENTIONS.md](./CONVENTIONS.md).

## Primitives

### Button

```tsx
import { Button } from '@kay-am/ui';

<Button onClick={handleClick}>save</Button>
<Button variant="secondary">cancel</Button>
<Button variant="ghost" size="sm">…</Button>
<Button variant="danger" disabled>delete</Button>
```

Variants: `primary` (default), `secondary`, `ghost`, `danger`. Sizes: `sm`, `md`.

### Input

```tsx
import { Input } from '@kay-am/ui';

<Input placeholder="search" value={q} onChange={(e) => setQ(e.target.value)} />;
```

### Textarea

```tsx
import { Textarea } from '@kay-am/ui';

<Textarea rows={4} placeholder="goal" />;
```

### ScrollArea

```tsx
import { ScrollArea } from '@kay-am/ui';

<ScrollArea className="h-64">{longList}</ScrollArea>;
```

### Collapsible

```tsx
import { Collapsible } from '@kay-am/ui';

<Collapsible open={open} onOpenChange={setOpen} trigger="files touched">
  <ul>{...}</ul>
</Collapsible>
```

### Dialog

Wraps native `<dialog>`. Esc closes; backdrop click does not.

```tsx
import { Dialog } from '@kay-am/ui';

<Dialog open={open} onClose={close} title="confirm">
  <p>are you sure?</p>
  <Button onClick={confirm}>yes</Button>
</Dialog>;
```

### KbdPill

```tsx
import { KbdPill } from '@kay-am/ui';

press <KbdPill>⌘K</KbdPill> to open
```

### AppShell

Three-pane layout: header on top, left sidebar, main, right sidebar. Each pane scrolls independently.

```tsx
import { AppShell } from '@kay-am/ui';

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
import { cn } from '@kay-am/ui';

<span className={cn('text-sm', isActive && 'font-medium')} />;
```
