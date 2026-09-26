import { useEffect, useState } from 'react';
import { WorkNode } from '@goodboy/ui';
import type { ThinkingContext } from '../../utils/thinking-context';
import { useElapsedMs } from '../../hooks/useElapsedMs';
import { formatDuration } from '../../utils/format-duration';

type Props = {
  readonly context: ThinkingContext;
};

const PHRASES: Record<ThinkingContext, readonly string[]> = {
  think: ['reasoning', 'planning', 'weighing options'],
  search: ['searching', 'reading files', 'tracing references'],
  edit: ['writing', 'editing', 'applying changes'],
  run: ['running', 'executing', 'collecting output'],
};

const ROTATE_MS = 2600;
const SETTLE_AFTER_TICKS = 8;
const SETTLED_PHRASE = 'still working';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const ThinkingIndicator = ({ context }: Props) => {
  const [reduced] = useState(prefersReducedMotion);
  const [tick, setTick] = useState(0);
  const elapsedMs = useElapsedMs({ running: true });

  useEffect(() => {
    if (reduced) {
      return;
    }
    const id = window.setInterval(() => setTick((t) => t + 1), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [reduced]);

  const phrases = PHRASES[context];
  const phrase =
    !reduced && tick >= SETTLE_AFTER_TICKS ? SETTLED_PHRASE : phrases[tick % phrases.length];
  const duration = elapsedMs != null ? formatDuration({ durationMs: elapsedMs }) : null;

  return (
    <div
      role="status"
      aria-label="Agent working"
      className="relative flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-2xs"
    >
      <WorkNode size="sm" state="running" mark={{ kind: 'dot' }} label="Thinking" />
      <span aria-hidden className="text-muted-foreground">
        {phrase}
      </span>
      {duration != null && (
        <span aria-hidden className="tabular-nums text-faint-foreground">
          · {duration}
        </span>
      )}
    </div>
  );
};
