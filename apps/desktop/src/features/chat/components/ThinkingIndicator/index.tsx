import { useEffect, useState } from 'react';
import { cn } from '@goodboy/ui';
import { DogMascot } from '../../../../shared/components/DogMascot';
import type { ThinkingContext } from '../../utils/thinking-context';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

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

  return (
    <div
      role="status"
      aria-label="Agent working"
      className="relative flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-2xs animate-border-pulse"
    >
      <DogMascot size={ICON_SIZE.row} className="text-muted-foreground/70" />
      <span aria-hidden className="text-muted-foreground/80">
        {phrase}
      </span>
    </div>
  );
};
