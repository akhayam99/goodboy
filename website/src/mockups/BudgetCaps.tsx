import { BRAND_PATH, type Brand } from '../components/BrandIcons';
import { useToggleInView } from '../components/Reveal';
import { CycleBar } from './CycleBar';
import { useCycle, usePrefersReducedMotion } from './motion';

type Line = {
  brand: Brand;
  label: string;
  cap: number;
  spent: number;
  spentAtCap?: number;
};

const LINES: ReadonlyArray<Line> = [
  { brand: 'anthropic', label: 'Claude', cap: 60, spent: 38.2, spentAtCap: 60 },
  { brand: 'codex', label: 'Codex', cap: 40, spent: 12.6, spentAtCap: 18.9 },
  { brand: 'cursor', label: 'Cursor', cap: 25, spent: 6.1 },
  { brand: 'gemini', label: 'Gemini', cap: 15, spent: 1.4 },
];

const usd = (value: number) => `$${value.toFixed(2)}`;

const ProviderGlyph = ({ brand }: { brand: Brand }) => (
  <svg width="10" height="10" viewBox="0 0 24 24" aria-hidden className="shrink-0">
    <path d={BRAND_PATH[brand]} fill={`var(--color-provider-${brand})`} />
  </svg>
);

export const BudgetCaps = () => {
  const reduced = usePrefersReducedMotion();
  const { ref: viewRef, inView } = useToggleInView<HTMLDivElement>();
  const beat = useCycle(2, 3800, inView && !reduced);
  const atCap = beat === 1;

  const total = LINES.reduce(
    (sum, line) => sum + (atCap ? (line.spentAtCap ?? line.spent) : line.spent),
    0,
  );

  return (
    <div
      ref={viewRef}
      aria-hidden="true"
      className="w-full rounded-xl border border-border-soft/70 bg-subtle/40 p-3"
    >
      <div className="flex h-5 items-center justify-between text-[9.5px] text-muted-foreground">
        <span className="font-semibold uppercase tracking-[0.08em]">Budget Studio</span>
        <span className="font-mono tabular-nums">{usd(total)} this month</span>
      </div>
      <CycleBar beat={beat} ms={3800} active={inView && !reduced} />

      <div className="mt-2 flex flex-col gap-2.5">
        {LINES.map((line) => {
          const spent = atCap ? (line.spentAtCap ?? line.spent) : line.spent;
          const pct = Math.min(100, (spent / line.cap) * 100);
          const exceeded = spent >= line.cap;
          return (
            <div key={line.label} className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-[10.5px]">
                <ProviderGlyph brand={line.brand} />
                <span className="font-medium text-foreground/85">{line.label}</span>
                <span
                  className={`ml-auto font-mono tabular-nums ${exceeded ? 'text-warning' : 'text-muted-foreground'}`}
                >
                  {usd(spent)} / {usd(line.cap)}
                </span>
              </div>
              <div className="relative h-1.5 overflow-hidden rounded-full bg-muted-foreground/15">
                <div
                  className={`h-full rounded-full transition-[width] duration-700 ease-out ${
                    exceeded ? 'bg-warning' : 'bg-primary/70'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex h-[26px] items-center gap-2 rounded-lg border border-border-soft/50 bg-muted/25 px-2.5 text-[9.5px]">
        {atCap ? (
          <span className="tg-fade flex items-center gap-2">
            <span className="chip chip-warning">cap reached</span>
            <span className="text-muted-foreground">New turns route to Codex, nothing stalls</span>
          </span>
        ) : (
          <span className="flex items-center gap-2 text-muted-foreground">
            <span className="chip chip-primary">alert at 80%</span>
            <span>Per provider, per month, plus a soft cap per session</span>
          </span>
        )}
      </div>
    </div>
  );
};
