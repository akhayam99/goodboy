import { Chip, Eyebrow, PANE_RHYTHM, cn } from '@goodboy/ui';

const ROLE_SAMPLES = [
  { role: 'text-display', className: 'text-display', sample: 'Connect your first provider' },
  { role: 'text-title', className: 'text-title', sample: 'Fix the half-cent rounding drift' },
  { role: 'text-heading', className: 'text-heading', sample: 'How do you want to start?' },
  { role: 'text-row', className: 'text-row', sample: 'Rewrite the Harborline retry queue' },
  {
    role: 'text-body',
    className: 'text-body',
    sample: 'Turns run in the session folder until you add one.',
  },
  {
    role: 'text-prose',
    className: 'text-prose',
    sample: 'The ledger-core cache keeps a failed lookup for the whole session.',
  },
  { role: 'text-label', className: 'text-label', sample: 'Step 3 ready' },
  { role: 'text-meta', className: 'text-meta', sample: 'PR #231 awaiting review' },
  { role: 'text-eyebrow', className: 'text-eyebrow', sample: 'In review' },
  { role: 'text-chip', className: 'text-chip', sample: 'Needs you' },
  { role: 'text-code', className: 'text-code', sample: 'nw/fix-posting-rounding' },
] as const;

const SPACING_STEPS = [
  { name: '1 · 4', className: 'w-1' },
  { name: '2 · 8', className: 'w-2' },
  { name: '3 · 12', className: 'w-3' },
  { name: '4 · 16', className: 'w-4' },
  { name: '6 · 24', className: 'w-6' },
  { name: '8 · 32', className: 'w-8' },
] as const;

const RADII = [
  { name: 'sm 4', className: 'h-6 w-14 rounded-sm bg-fill' },
  { name: 'md 6', className: 'h-8 w-20 rounded-md border border-border' },
  { name: 'lg 8', className: 'h-16 w-24 rounded-lg border border-border-soft bg-elevated' },
  { name: 'frame 10', className: 'h-16 w-28 rounded-l-frame border border-r-0 border-frame-edge' },
  { name: 'full', className: 'size-8 rounded-full bg-fill' },
] as const;

const LEVELS = [
  { name: '2 band', className: 'rounded-lg bg-fill px-2 py-2' },
  {
    name: '3 card',
    className: 'rounded-lg border border-border-soft bg-elevated px-2 py-2 shadow-sm',
  },
  {
    name: '4 floating',
    className: 'rounded-lg border border-border bg-floating px-2 py-2 shadow-lg',
  },
  {
    name: '5 tooltip',
    className: 'rounded-md bg-foreground px-2 py-2 text-background shadow-md',
  },
] as const;

export const DesignScaleScene = () => (
  <main className="flex h-screen w-full flex-col gap-8 overflow-hidden bg-chrome p-6 text-foreground">
    <section aria-label="Type roles" className="flex flex-col gap-2">
      <Eyebrow label="Type roles" />
      <dl className="grid grid-cols-[160px_1fr] items-baseline gap-x-6 gap-y-2">
        {ROLE_SAMPLES.map(({ role, className, sample }) => (
          <div key={role} className="contents">
            <dt className="text-code text-muted-foreground">{role}</dt>
            <dd className={className}>{sample}</dd>
          </div>
        ))}
      </dl>
    </section>
    <section aria-label="Rows" className="flex flex-col gap-2">
      <Eyebrow label="Rows" />
      <div className="flex max-w-xl flex-col gap-1">
        <div
          className={cn('flex items-center gap-2 rounded-md bg-selected', PANE_RHYTHM.navRail.row)}
        >
          <span className="min-w-0 flex-1 truncate text-row text-foreground">Sidebar row</span>
          <span className="text-meta text-faint-foreground">2h</span>
        </div>
        <div className={cn('flex flex-col rounded-md bg-fill', PANE_RHYTHM.navRail.rowTwo)}>
          <span className="truncate text-row text-foreground">Sidebar row, two lines</span>
          <span className="truncate text-meta text-muted-foreground">PR #231 awaiting review</span>
        </div>
        <div className="flex h-8 items-center gap-2 rounded-md bg-fill px-2">
          <span className="min-w-0 flex-1 truncate text-row text-foreground">Activity row</span>
          <span className="text-meta text-faint-foreground">19:34</span>
        </div>
        <div className="flex flex-col gap-2 rounded-lg border border-border-soft bg-elevated p-3">
          <span className="text-title text-foreground">Board card title</span>
          <Chip tone="neutral" label="Needs you" kind="state" />
        </div>
      </div>
    </section>
    <section aria-label="Spacing" className="flex flex-col gap-2">
      <Eyebrow label="Spacing" />
      <ul className="flex items-end gap-6">
        {SPACING_STEPS.map(({ name, className }) => (
          <li key={name} className="flex flex-col items-start gap-2">
            <span className={cn('h-4 bg-muted-foreground', className)} />
            <span className="text-chip text-muted-foreground">{name}</span>
          </li>
        ))}
      </ul>
    </section>
    <section aria-label="Radius" className="flex flex-col gap-2">
      <Eyebrow label="Radius" />
      <ul className="flex items-end gap-6">
        {RADII.map(({ name, className }) => (
          <li key={name} className="flex flex-col items-center gap-2">
            <span className={className} />
            <span className="text-meta text-muted-foreground">{name}</span>
          </li>
        ))}
      </ul>
    </section>
    <section aria-label="Elevation" className="flex flex-col gap-2">
      <Eyebrow label="Elevation" />
      <div className="flex max-w-xl flex-col gap-3 rounded-l-frame border border-r-0 border-frame-edge bg-background p-3">
        {LEVELS.map(({ name, className }) => (
          <div key={name} className={cn('text-meta', className)}>
            {name}
          </div>
        ))}
        <span className="text-meta text-faint-foreground">1 sheet on 0 frame</span>
      </div>
    </section>
  </main>
);
