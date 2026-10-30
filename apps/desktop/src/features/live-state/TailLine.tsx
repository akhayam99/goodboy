import type { ReactNode } from 'react';
import { Button, cn, FOCUS_RING, TruncatedText } from '@goodboy/ui';
import { TailGlyph } from './TailGlyph';
import { useTailClock } from './useTailClock';
import type { TailActionId, TailFacts, TailState } from './tailFacts';

type Props = {
  readonly facts: TailFacts;
  readonly onAction: (id: TailActionId) => void;
  readonly verbs?: ReactNode;
};

const TICKING: ReadonlySet<TailState> = new Set(['working', 'waiting', 'queued', 'stopping']);

const RUNNING: ReadonlySet<TailState> = new Set(['working', 'queued']);

const READS_IN_FULL: ReadonlySet<TailState> = new Set(['failed', 'paused']);

const WAITS_FOR_YOU: ReadonlySet<TailState> = new Set(['needsYou', 'paused', 'failed', 'stopped']);

const PHRASE_CLASS = {
  working: 'motion-safe:text-shimmer text-foreground',
  queued: 'motion-safe:text-shimmer text-foreground',
  waiting: 'text-muted-foreground',
  stopping: 'text-muted-foreground',
  needsYou: 'text-foreground',
  paused: 'text-foreground',
  failed: 'text-foreground',
  stopped: 'text-muted-foreground',
  idle: 'text-muted-foreground',
} as const satisfies Record<TailState, string>;

const QUIET_ACTION = cn(
  'inline-flex h-6 items-center gap-1 rounded-md px-2 text-ui text-muted-foreground hover:bg-hover hover:text-foreground',
  FOCUS_RING,
);

export const TailLine = ({ facts, onAction, verbs = null }: Props) => {
  const clock = useTailClock({
    startedAt: facts.startedAt,
    stepAgentId: facts.stepAgentId ?? null,
    isTicking: TICKING.has(facts.state),
    isRunning: RUNNING.has(facts.state),
  });
  const hasForward = WAITS_FOR_YOU.has(facts.state);
  const isFull = READS_IN_FULL.has(facts.state);
  return (
    <div
      data-tail=""
      data-tail-state={facts.state}
      className={cn('flex min-h-7 min-w-0 gap-2 text-ui', isFull ? 'items-start' : 'items-center')}
    >
      <span className="flex size-5 shrink-0 items-center justify-center" aria-hidden>
        <TailGlyph state={facts.state} />
      </span>
      <span
        className={cn(
          'flex min-w-0 flex-1 items-center gap-x-2 gap-y-1',
          isFull ? 'flex-wrap' : null,
        )}
      >
        {isFull ? (
          <TruncatedText
            lines={2}
            isFocusable
            className={cn('min-w-0 grow', PHRASE_CLASS[facts.state], FOCUS_RING)}
          >
            {facts.phrase}
          </TruncatedText>
        ) : (
          <span className={cn('min-w-0 truncate', PHRASE_CLASS[facts.state])}>{facts.phrase}</span>
        )}
        {clock === null ? null : (
          <span aria-hidden className="shrink-0 tabular-nums text-faint-foreground">
            {clock}
          </span>
        )}
        {facts.actions.length === 0 && verbs === null ? null : (
          <span className="flex shrink-0 items-center gap-1">
            {isFull ? null : (
              <span aria-hidden className="text-faint-foreground">
                ·
              </span>
            )}
            {verbs}
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
              ) : action.isBusy === true ? (
                <Button
                  key={action.id}
                  variant="quiet"
                  size="xs"
                  isBusy
                  aria-label={action.label}
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
      </span>
    </div>
  );
};
