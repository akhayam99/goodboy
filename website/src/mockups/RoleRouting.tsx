import { BRAND_PATH, type Brand } from '../components/BrandIcons';
import { useToggleInView } from '../components/Reveal';
import { CycleBar } from './CycleBar';
import { useCycle, usePrefersReducedMotion } from './motion';

type Effort = 'low' | 'medium' | 'high';

type Routing = {
  brand: Brand;
  model: string;
  effort: Effort;
};

type Row = {
  role: string;
  job: string;
  base: Routing;
  override?: Routing;
};

const ROWS: ReadonlyArray<Row> = [
  {
    role: 'Scout',
    job: 'survey the repo, list the files that matter',
    base: { brand: 'anthropic', model: 'Haiku 4.5', effort: 'low' },
  },
  {
    role: 'Planner',
    job: 'design the change, produce an ordered plan',
    base: { brand: 'anthropic', model: 'Opus 5', effort: 'high' },
  },
  {
    role: 'Implementer',
    job: 'apply the plan in small commits',
    base: { brand: 'anthropic', model: 'Sonnet 5', effort: 'medium' },
    override: { brand: 'codex', model: 'GPT-5.6', effort: 'high' },
  },
  {
    role: 'Tester',
    job: 'cover the happy path and the edges',
    base: { brand: 'anthropic', model: 'Sonnet 5', effort: 'medium' },
  },
  {
    role: 'Reviewer',
    job: 'audit the diff, run tests, flag drift',
    base: { brand: 'anthropic', model: 'Sonnet 5', effort: 'medium' },
    override: { brand: 'cursor', model: 'Composer 2.5', effort: 'medium' },
  },
];

const EFFORT_WIDTH: Record<Effort, string> = {
  low: 'w-1.5',
  medium: 'w-3',
  high: 'w-[18px]',
};

const ProviderGlyph = ({ brand }: { brand: Brand }) => (
  <svg width="10" height="10" viewBox="0 0 24 24" aria-hidden className="shrink-0">
    <path d={BRAND_PATH[brand]} fill={`var(--color-provider-${brand})`} />
  </svg>
);

const EffortMeter = ({ effort }: { effort: Effort }) => (
  <span className="inline-flex items-center gap-1.5 text-[9.5px] text-muted-foreground">
    <span className="relative inline-block h-1 w-[18px] rounded-full bg-muted-foreground/20">
      <span
        className={`absolute inset-y-0 left-0 rounded-full bg-muted-foreground/60 ${EFFORT_WIDTH[effort]}`}
      />
    </span>
    {effort}
  </span>
);

export const RoleRouting = () => {
  const reduced = usePrefersReducedMotion();
  const { ref: viewRef, inView } = useToggleInView<HTMLDivElement>();
  const beat = useCycle(2, 3400, inView && !reduced);
  const overridden = beat === 1;

  return (
    <div
      ref={viewRef}
      aria-hidden="true"
      className="w-full rounded-xl border border-border-soft/70 bg-subtle/40 p-3"
    >
      <div className="flex h-5 items-center justify-between text-[9.5px] text-muted-foreground">
        <span className="font-semibold uppercase tracking-[0.08em]">Provider Studio</span>
        <span className="font-mono">acme-web</span>
      </div>
      <CycleBar beat={beat} ms={3400} active={inView && !reduced} />

      <div className="mt-2 flex flex-col">
        {ROWS.map((row) => {
          const routing = overridden && row.override ? row.override : row.base;
          const isOverridden = overridden && row.override != null;
          return (
            <div
              key={row.role}
              className={`flex items-center gap-3 border-t border-border-soft/50 py-2 first:border-t-0 ${
                isOverridden ? 'text-foreground' : ''
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="text-[11.5px] font-semibold text-foreground/90">{row.role}</span>
                  {isOverridden && (
                    <span className="tg-fade text-[9px] font-medium text-primary">overridden</span>
                  )}
                </span>
                <span className="mt-0.5 line-clamp-1 block text-[10px] text-muted-foreground">
                  {row.job}
                </span>
              </span>

              <span
                key={`${row.role}-${routing.model}`}
                className="tg-fade flex w-[104px] shrink-0 items-center justify-end gap-1.5 text-[10.5px] text-foreground/85"
              >
                <ProviderGlyph brand={routing.brand} />
                {routing.model}
              </span>

              <span className="hidden w-[76px] shrink-0 justify-end sm:flex">
                <EffortMeter effort={routing.effort} />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
