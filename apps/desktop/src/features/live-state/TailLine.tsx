import { Button, cn } from '@goodboy/ui';
import { TailGlyph } from './TailGlyph';
import { useTailClock } from './useTailClock';
import type { TailActionId, TailFacts, TailState } from './tailFacts';

type Props = {
  readonly facts: TailFacts;
  readonly onAction: (id: TailActionId) => void;
};

const TICKING: ReadonlySet<TailState> = new Set(['working', 'waiting', 'queued']);

const WAITS_FOR_YOU: ReadonlySet<TailState> = new Set(['paused', 'failed', 'stopped']);

const PHRASE_CLASS = {
  working: 'motion-safe:text-shimmer text-foreground',
  queued: 'motion-safe:text-shimmer text-foreground',
  waiting: 'text-muted-foreground',
  paused: 'text-foreground',
  failed: 'text-foreground',
  stopped: 'text-muted-foreground',
  idle: 'text-muted-foreground',
} as const satisfies Record<TailState, string>;

const QUIET_ACTION =
  'inline-flex h-6 items-center gap-1 rounded-md px-2 text-ui text-muted-foreground hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring';

export const TailLine = ({ facts, onAction }: Props) => {
  const clock = useTailClock({
    startedAt: facts.startedAt,
    isTicking: TICKING.has(facts.state),
  });
  const hasForward = WAITS_FOR_YOU.has(facts.state);
  return (
    <div
      data-tail=""
      data-tail-state={facts.state}
      className="flex h-7 min-w-0 items-center gap-2 text-ui"
    >
      <span className="flex size-5 shrink-0 items-center justify-center" aria-hidden>
        <TailGlyph state={facts.state} />
      </span>
      <span className={cn('min-w-0 truncate', PHRASE_CLASS[facts.state])}>{facts.phrase}</span>
      {clock === null ? null : (
        <span aria-hidden className="shrink-0 tabular-nums text-faint-foreground">
          {clock}
        </span>
      )}
      {facts.actions.length === 0 ? null : (
        <span className="flex shrink-0 items-center gap-1">
          <span aria-hidden className="text-faint-foreground">
            ·
          </span>
          {facts.actions.map((action, index) =>
            hasForward && index === 0 ? (
              <Button
                key={action.id}
                variant="secondary"
                size="xs"
                onClick={() => onAction(action.id)}
              >
                {action.label}
              </Button>
            ) : (
              <button
                key={action.id}
                type="button"
                className={QUIET_ACTION}
                onClick={() => onAction(action.id)}
              >
                {action.label}
              </button>
            ),
          )}
        </span>
      )}
    </div>
  );
};
