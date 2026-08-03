import { BRAND_PATH, type Brand } from '../components/BrandIcons';
import { useToggleInView } from '../components/Reveal';
import { CycleBar } from './CycleBar';
import { useCycle, usePrefersReducedMotion } from './motion';

type Step = {
  name: string;
  brand: Brand;
  model: string;
  effort: string;
  expects: string;
};

const STEPS: ReadonlyArray<Step> = [
  {
    name: 'Scout',
    brand: 'anthropic',
    model: 'Haiku 4.5',
    effort: 'low',
    expects: 'the files that matter',
  },
  {
    name: 'Plan',
    brand: 'anthropic',
    model: 'Opus 5',
    effort: 'high',
    expects: 'an ordered plan',
  },
  {
    name: 'Implement',
    brand: 'codex',
    model: 'GPT-5.6',
    effort: 'high',
    expects: 'commits on the branch',
  },
  {
    name: 'Test',
    brand: 'anthropic',
    model: 'Sonnet 5',
    effort: 'medium',
    expects: 'a green suite',
  },
  {
    name: 'Review',
    brand: 'cursor',
    model: 'Composer 2.5',
    effort: 'medium',
    expects: 'a verdict on the diff',
  },
];

const ProviderGlyph = ({ brand }: { brand: Brand }) => (
  <svg width="10" height="10" viewBox="0 0 24 24" aria-hidden className="shrink-0">
    <path d={BRAND_PATH[brand]} fill={`var(--color-provider-${brand})`} />
  </svg>
);

const StateDot = ({ state }: { state: 'done' | 'running' | 'pending' }) => (
  <span className="relative flex size-4 items-center justify-center">
    {state === 'running' && (
      <span className="pulse absolute inset-0 rounded-full border border-info" />
    )}
    <span
      className={`size-1.5 rounded-full ${
        state === 'done' ? 'bg-success' : state === 'running' ? 'bg-info' : 'bg-muted-foreground/40'
      }`}
    />
  </span>
);

export const WorkflowSteps = () => {
  const reduced = usePrefersReducedMotion();
  const { ref: viewRef, inView } = useToggleInView<HTMLDivElement>();
  const beat = useCycle(3, 3200, inView && !reduced);
  const current = 2 + beat;

  return (
    <div
      ref={viewRef}
      aria-hidden="true"
      className="w-full rounded-xl border border-border-soft/70 bg-subtle/40 p-3"
    >
      <div className="flex h-5 items-center justify-between text-[9.5px] text-muted-foreground">
        <span className="font-semibold uppercase tracking-[0.08em]">Ship a bugfix</span>
        <span className="flex items-center gap-1.5">
          auto-run
          <span className="inline-flex h-3 w-5 items-center rounded-full bg-primary/70 px-[2px]">
            <span className="ml-auto size-2 rounded-full bg-primary-foreground" />
          </span>
        </span>
      </div>
      <CycleBar beat={beat} ms={3200} active={inView && !reduced} />

      <div className="mt-2 flex flex-col">
        {STEPS.map((step, i) => {
          const state = i < current ? 'done' : i === current ? 'running' : 'pending';
          return (
            <div
              key={step.name}
              className={`flex items-center gap-2.5 border-t border-border-soft/50 py-2 first:border-t-0 ${
                state === 'pending' ? 'opacity-60' : ''
              }`}
            >
              <StateDot state={state} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-1.5">
                  <span className="text-[11.5px] font-semibold text-foreground/90">
                    {step.name}
                  </span>
                  <span className="text-[9.5px] text-muted-foreground">expects {step.expects}</span>
                </span>
              </span>
              <span className="flex w-[104px] shrink-0 items-center justify-end gap-1.5 text-[10.5px] text-foreground/85">
                <ProviderGlyph brand={step.brand} />
                {step.model}
              </span>
              <span className="hidden w-14 shrink-0 text-right text-[9.5px] text-muted-foreground sm:block">
                {step.effort}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
