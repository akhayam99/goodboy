import { BRAND_PATH, type Brand } from '../components/BrandIcons';
import { useToggleInView } from '../components/Reveal';
import { CycleBar } from './CycleBar';
import { useCycle, usePrefersReducedMotion } from './motion';

type State = 'done' | 'running' | 'pending';

type Child = {
  name: string;
  brand: Brand;
  model: string;
};

const SCOUTS: ReadonlyArray<Child> = [
  { name: 'packages/core', brand: 'anthropic', model: 'Haiku 4.5' },
  { name: 'apps/desktop', brand: 'anthropic', model: 'Haiku 4.5' },
  { name: 'website', brand: 'anthropic', model: 'Haiku 4.5' },
];

const CLUSTERS: ReadonlyArray<Child> = [
  { name: 'store slices', brand: 'anthropic', model: 'Sonnet 5' },
  { name: 'desktop panes', brand: 'anthropic', model: 'Sonnet 5' },
  { name: 'tests', brand: 'anthropic', model: 'Sonnet 5' },
];

const ProviderGlyph = ({ brand }: { brand: Brand }) => (
  <svg width="9" height="9" viewBox="0 0 24 24" aria-hidden className="shrink-0">
    <path d={BRAND_PATH[brand]} fill={`var(--color-provider-${brand})`} />
  </svg>
);

const StateDot = ({ state }: { state: State }) => (
  <span className="relative flex size-4 shrink-0 items-center justify-center">
    {state === 'running' && (
      <span className="pulse absolute inset-0 rounded-full border border-info" />
    )}
    {state === 'done' ? (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-success">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
        <path
          d="m9 12 2 2 4-4"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ) : (
      <span
        className={`size-1.5 rounded-full ${state === 'running' ? 'bg-info' : 'bg-muted-foreground/40'}`}
      />
    )}
  </span>
);

const Panel = ({
  root,
  note,
  rootState,
  children,
  childState,
}: {
  root: string;
  note: string;
  rootState: State;
  children: ReadonlyArray<Child>;
  childState: State;
}) => (
  <div className="rounded-lg border border-border-soft/50 bg-background/40 p-2.5">
    <div className={`flex items-center gap-2 ${rootState === 'pending' ? 'opacity-60' : ''}`}>
      <StateDot state={rootState} />
      <span className="text-[11.5px] font-semibold text-foreground/90">{root}</span>
      <span className="min-w-0 truncate text-[9.5px] text-muted-foreground">{note}</span>
    </div>
    <div className="ml-[7px] mt-1.5 flex flex-col gap-1.5 border-l border-border-soft/60 pl-3">
      {children.map((child) => (
        <div
          key={child.name}
          className={`flex items-center gap-2 ${childState === 'pending' ? 'opacity-60' : ''}`}
        >
          <StateDot state={childState} />
          <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-foreground/85">
            {child.name}
          </span>
          <span className="flex shrink-0 items-center gap-1 text-[9.5px] text-muted-foreground">
            <ProviderGlyph brand={child.brand} />
            {child.model}
          </span>
        </div>
      ))}
    </div>
  </div>
);

export const FanOut = () => {
  const reduced = usePrefersReducedMotion();
  const { ref: viewRef, inView } = useToggleInView<HTMLDivElement>();
  const beat = useCycle(4, 2600, inView && !reduced);

  const scoutState: State = beat === 0 ? 'running' : 'done';
  const planState: State = beat === 0 ? 'pending' : beat === 1 ? 'running' : 'done';
  const clusterState: State = beat < 2 ? 'pending' : beat === 2 ? 'running' : 'done';

  return (
    <div
      ref={viewRef}
      aria-hidden="true"
      className="w-full rounded-xl border border-border-soft/70 bg-subtle/40 p-3"
    >
      <div className="flex h-5 items-center justify-between text-[9.5px] text-muted-foreground">
        <span className="font-semibold uppercase tracking-[0.08em]">Repo-wide refactor</span>
        <span className="font-mono">8 agents, one thread</span>
      </div>
      <CycleBar beat={beat} ms={2600} active={inView && !reduced} />

      <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
        <Panel
          root="Scout"
          note="splits by area"
          rootState={scoutState}
          childState={scoutState}
          children={SCOUTS}
        />
        <Panel
          root="Plan"
          note="one implementer per cluster"
          rootState={planState}
          childState={clusterState}
          children={CLUSTERS}
        />
      </div>

      <div className="mt-2.5 flex h-[26px] items-center gap-2 rounded-lg border border-border-soft/50 bg-muted/25 px-2.5 text-[9.5px] text-muted-foreground">
        <span className="chip chip-primary">depth capped at 2</span>
        <span>Every result merges back into the same session thread</span>
      </div>
    </div>
  );
};
