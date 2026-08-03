import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BRAND_PATH, type Brand } from '../components/BrandIcons';
import { useToggleInView } from '../components/Reveal';

type Beat = 'idle' | 'reroute' | 'prchip' | 'move' | 'hold';

const BEATS: ReadonlyArray<Beat> = ['idle', 'reroute', 'prchip', 'move', 'hold'];

const DUR: Record<Beat, number> = {
  idle: 2600,
  reroute: 2600,
  prchip: 1400,
  move: 1000,
  hold: 4000,
};

const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
};

type ColumnKey = 'building' | 'running' | 'attention' | 'review' | 'done';

const COLUMN_LABEL: Record<ColumnKey, string> = {
  building: 'building',
  running: 'running',
  attention: 'needs you',
  review: 'in review',
  done: 'done',
};

const COLUMN_TONE: Record<ColumnKey, string> = {
  building: 'text-muted-foreground ring-border-soft',
  running: 'text-info ring-info/25',
  attention: 'text-warning ring-warning/25',
  review: 'text-success ring-success/25',
  done: 'text-merged ring-merged/25',
};

const ColumnHeader = ({ column, count }: { column: ColumnKey; count: number }) => (
  <div className="flex h-5 items-center gap-1.5">
    <span
      className={`inline-flex items-center rounded-[4px] bg-muted/40 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] ring-1 ${COLUMN_TONE[column]}`}
    >
      {COLUMN_LABEL[column]}
    </span>
    <span className="text-[9.5px] tabular-nums text-muted-foreground/60">{count}</span>
  </div>
);

const ProviderGlyph = ({ brand }: { brand: Brand }) => (
  <svg width="9" height="9" viewBox="0 0 24 24" aria-hidden className="shrink-0">
    <path d={BRAND_PATH[brand]} fill={`var(--color-provider-${brand})`} />
  </svg>
);

type Card = {
  goal: string;
  cost: string;
  agents: number;
  brand?: Brand;
  model?: string;
  prNumber?: number;
  openQuestion?: boolean;
  note?: string;
  noteTone?: 'warning' | 'success';
  muted?: boolean;
  tone?: 'running' | 'attention';
  breathing?: boolean;
};

const StageBoardCard = forwardRef<HTMLDivElement, Card>(function StageBoardCard(
  {
    goal,
    cost,
    agents,
    brand,
    model,
    prNumber,
    openQuestion,
    note,
    noteTone = 'warning',
    muted,
    tone,
    breathing,
  },
  ref,
) {
  const borderClass =
    tone === 'running'
      ? 'border-info/50'
      : tone === 'attention'
        ? 'border-warning/50'
        : 'border-border-soft/60';

  return (
    <div
      ref={ref}
      className={`relative flex h-[74px] flex-col rounded-lg border bg-muted/40 px-2.5 py-2 sm:h-[84px] ${borderClass} ${muted ? 'opacity-55' : ''}`}
    >
      {breathing && (
        <span
          className="pointer-events-none absolute inset-0 rounded-lg border border-info"
          style={{ animation: 'soft-pulse 2.4s ease-in-out infinite' }}
        />
      )}
      <span className="line-clamp-2 flex-1 text-[11px] font-medium leading-snug text-foreground/90">
        {goal}
      </span>
      <span
        className={`h-[12px] overflow-hidden text-[9px] leading-[12px] ${noteTone === 'success' ? 'text-success' : 'text-warning'}`}
      >
        {note ? <span className="tg-fade block">{note}</span> : null}
      </span>
      <span className="flex h-[14px] items-center gap-1.5 overflow-hidden whitespace-nowrap text-[9.5px] leading-[14px] text-muted-foreground">
        {openQuestion ? (
          <span className="shrink-0 font-medium text-warning">1 open question</span>
        ) : (
          <span className="shrink-0 tabular-nums">
            {agents} agent{agents === 1 ? '' : 's'}
          </span>
        )}
        {brand && (
          <span key={brand} className="tg-fade inline-flex shrink-0 items-center gap-1">
            <ProviderGlyph brand={brand} />
            {model}
          </span>
        )}
        {prNumber != null && (
          <span className="tg-fade shrink-0 rounded-[4px] bg-muted-foreground/10 px-1.5 tabular-nums">
            PR #{prNumber}
          </span>
        )}
        <span className="ml-auto shrink-0 tabular-nums">{cost}</span>
      </span>
    </div>
  );
});

export const StageBoard = () => {
  const reduced = usePrefersReducedMotion();
  const { ref: viewRef, inView } = useToggleInView<HTMLDivElement>();
  const [beatIndex, setBeatIndex] = useState(0);
  const movingRef = useRef<HTMLDivElement | null>(null);
  const prevRectRef = useRef<DOMRect | null>(null);

  useEffect(() => {
    if (reduced || !inView) {
      return undefined;
    }
    const currentBeat = BEATS[beatIndex];
    const id = window.setTimeout(() => {
      if (currentBeat === 'prchip') {
        prevRectRef.current = movingRef.current?.getBoundingClientRect() ?? null;
      }
      setBeatIndex((prev) => (prev + 1) % BEATS.length);
    }, DUR[currentBeat]);
    return () => window.clearTimeout(id);
  }, [beatIndex, inView, reduced]);

  useLayoutEffect(() => {
    if (reduced) {
      return;
    }
    if (BEATS[beatIndex] !== 'move' || prevRectRef.current == null || movingRef.current == null) {
      return;
    }
    const before = prevRectRef.current;
    const node = movingRef.current;
    const after = node.getBoundingClientRect();
    const dx = before.left - after.left;
    const dy = before.top - after.top;
    prevRectRef.current = null;
    if (dx === 0 && dy === 0) {
      return;
    }
    node.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], {
      duration: 400,
      easing: 'cubic-bezier(0.2, 0, 0, 1)',
    });
  }, [beatIndex, reduced]);

  const beat = reduced ? 'hold' : BEATS[beatIndex];
  const rerouted = beat !== 'idle';
  const prChipVisible = beat === 'prchip' || beat === 'move' || beat === 'hold';
  const moved = beat === 'move' || beat === 'hold';

  const migrateCard: Card = {
    goal: 'Migrate billing webhooks',
    cost: '$1.86',
    agents: 2,
    brand: 'anthropic',
    model: 'Opus 5',
    prNumber: prChipVisible ? 131 : undefined,
    tone: moved ? undefined : 'running',
    breathing: beat === 'idle',
  };

  const runningCount = moved ? 1 : 2;
  const reviewCount = moved ? 2 : 1;

  return (
    <div ref={viewRef} aria-hidden="true" className="w-full">
      <div className="flex h-5 items-center justify-between gap-3 px-0.5 text-[9.5px] text-muted-foreground">
        <span className="font-medium text-foreground/70">acme-web</span>
        <span className="font-mono tabular-nums">
          1 needs you · {runningCount} running · {rerouted ? '$4.31' : '$4.12'} today
        </span>
      </div>

      <div className="mt-2 sm:overflow-x-auto sm:pb-1">
        <div className="flex flex-col gap-4 sm:grid sm:min-w-[720px] sm:grid-cols-5 sm:gap-3">
          <div className="hidden flex-col gap-2 sm:flex">
            <ColumnHeader column="building" count={1} />
            <StageBoardCard goal="Search index rebuild" cost="$0.62" agents={1} prNumber={126} />
          </div>

          <div className="flex flex-col gap-2">
            <ColumnHeader column="running" count={runningCount} />
            {!moved && <StageBoardCard ref={movingRef} {...migrateCard} />}
            <StageBoardCard
              goal="Fix flaky session tests"
              cost="$1.12"
              agents={1}
              brand={rerouted ? 'codex' : 'anthropic'}
              model={rerouted ? 'GPT-5.6' : 'Opus 5'}
              note={rerouted ? 'cap reached, rerouted' : undefined}
              tone="running"
            />
          </div>

          <div className="flex flex-col gap-2">
            <ColumnHeader column="attention" count={1} />
            <StageBoardCard
              goal="Dark mode audit"
              cost="$0.44"
              agents={1}
              openQuestion
              tone="attention"
            />
          </div>

          <div className="flex flex-col gap-2">
            <ColumnHeader column="review" count={reviewCount} />
            <StageBoardCard
              goal="Password reset flow"
              cost="$0.87"
              agents={1}
              prNumber={128}
              note="checks green"
              noteTone="success"
            />
            {moved && <StageBoardCard ref={movingRef} {...migrateCard} />}
          </div>

          <div className="hidden flex-col gap-2 sm:flex">
            <ColumnHeader column="done" count={2} />
            <StageBoardCard goal="Rate-limit middleware" cost="$0.31" agents={2} muted />
            <StageBoardCard goal="Onboarding copy pass" cost="$0.58" agents={1} muted />
          </div>
        </div>
      </div>
    </div>
  );
};
