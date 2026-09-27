import { Eyebrow, cn } from '@goodboy/ui';

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
  { role: 'text-secondary', className: 'text-secondary', sample: 'PR #231 awaiting review' },
  { role: 'text-eyebrow', className: 'text-eyebrow', sample: 'In review' },
  { role: 'text-meta', className: 'text-meta', sample: '07:34 PM · $2.15 · 25m' },
  { role: 'text-code', className: 'text-code', sample: 'nw/fix-posting-rounding' },
] as const;

const RADII = [
  { name: 'sm 4', className: 'h-6 w-14 rounded-sm bg-fill' },
  { name: 'md 6', className: 'h-8 w-20 rounded-md border border-border' },
  { name: 'lg 8', className: 'h-16 w-24 rounded-lg border border-border-soft bg-elevated' },
  { name: 'frame 10', className: 'h-16 w-28 rounded-l-frame border border-r-0 border-frame-edge' },
  { name: 'full', className: 'size-8 rounded-full bg-fill' },
] as const;

const LEVELS = [
  { name: '2 band', className: 'rounded-lg bg-fill px-2 py-1.5' },
  {
    name: '3 card',
    className: 'rounded-lg border border-border-soft bg-elevated px-2 py-1.5 shadow-sm',
  },
  {
    name: '4 floating',
    className: 'rounded-lg border border-border bg-floating px-2 py-1.5 shadow-lg',
  },
  {
    name: '5 tooltip',
    className: 'rounded-md bg-foreground px-2 py-1.5 text-background shadow-md',
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
    <section aria-label="Radius" className="flex flex-col gap-2">
      <Eyebrow label="Radius" />
      <ul className="flex items-end gap-6">
        {RADII.map(({ name, className }) => (
          <li key={name} className="flex flex-col items-center gap-2">
            <span className={className} />
            <span className="text-secondary text-muted-foreground">{name}</span>
          </li>
        ))}
      </ul>
    </section>
    <section aria-label="Elevation" className="flex flex-col gap-2">
      <Eyebrow label="Elevation" />
      <div className="flex max-w-xl flex-col gap-2.5 rounded-l-frame border border-r-0 border-frame-edge bg-background p-3">
        {LEVELS.map(({ name, className }) => (
          <div key={name} className={cn('text-secondary', className)}>
            {name}
          </div>
        ))}
        <span className="text-meta text-faint-foreground">1 sheet on 0 frame</span>
      </div>
    </section>
  </main>
);
