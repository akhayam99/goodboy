import { useEffect, useState } from 'react';
import type { ThinkingContext } from '../../utils/thinking-context';

type Params = {
  readonly context: ThinkingContext;
};

const PHRASES: Record<ThinkingContext, readonly string[]> = {
  think: ['Thinking it through', 'Planning the next step', 'Weighing the options'],
  search: ['Searching the code', 'Reading the files', 'Tracing the references'],
  edit: ['Writing the changes', 'Editing the files', 'Applying the changes'],
  run: ['Running the command', 'Collecting the output'],
};

const ROTATE_MS = 2600;
const SETTLE_AFTER_TICKS = 8;
const SETTLED_PHRASE = 'Still working';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const useThinkingPhrase = ({ context }: Params): string => {
  const [isReduced] = useState(prefersReducedMotion);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (isReduced) {
      return;
    }
    const id = window.setInterval(() => setTick((value) => value + 1), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [isReduced]);

  const phrases = PHRASES[context];
  if (!isReduced && tick >= SETTLE_AFTER_TICKS) {
    return SETTLED_PHRASE;
  }
  return phrases[tick % phrases.length] ?? SETTLED_PHRASE;
};
