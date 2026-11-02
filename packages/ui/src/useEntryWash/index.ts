import { useEffect, useState } from 'react';
import { prefersReducedMotion } from '../prefersReducedMotion';
import { DURATION_QUICK_MS } from '../motionTimings';
import { sameKeys } from '../sameKeys';

type Params = {
  readonly keys: ReadonlyArray<string>;
};

type WashState = {
  readonly keys: ReadonlyArray<string>;
  readonly washed: ReadonlySet<string>;
};

const NO_KEYS: ReadonlySet<string> = new Set();

export const useEntryWash = ({ keys }: Params): ReadonlySet<string> => {
  const [state, setState] = useState<WashState>(() => ({ keys, washed: NO_KEYS }));
  if (!sameKeys({ left: state.keys, right: keys })) {
    const previous = new Set(state.keys);
    const arrived = keys.filter((key) => !previous.has(key));
    setState({
      keys,
      washed: prefersReducedMotion() ? NO_KEYS : new Set([...state.washed, ...arrived]),
    });
  }
  const { washed } = state;

  useEffect(() => {
    if (washed.size === 0) {
      return;
    }
    const timer = window.setTimeout(
      () => setState((prev) => ({ ...prev, washed: NO_KEYS })),
      DURATION_QUICK_MS,
    );
    return () => window.clearTimeout(timer);
  }, [washed]);

  return washed;
};
