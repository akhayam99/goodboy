import { useEffect } from 'react';

type Params = {
  readonly start: () => Promise<() => void>;
};

export const useAsyncSubscription = ({ start }: Params) => {
  useEffect(() => {
    let stop: (() => void) | null = null;
    let cancelled = false;
    void start().then((teardown) => {
      if (cancelled) {
        teardown();
        return;
      }
      stop = teardown;
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [start]);
};
