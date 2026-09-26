import { useEffect, useRef, useState } from 'react';
import { formatError } from '@goodboy/ui';

const DEBOUNCE_MS = 500;

export type DebouncedCheck<T> =
  | { readonly status: 'idle' }
  | { readonly status: 'checking' }
  | { readonly status: 'ok'; readonly value: T }
  | { readonly status: 'error'; readonly error: string };

type Params<T> = {
  readonly key: string | null;
  readonly run: () => Promise<T>;
  readonly delayMs?: number;
};

export const useDebouncedCheck = <T>({
  key,
  run,
  delayMs = DEBOUNCE_MS,
}: Params<T>): DebouncedCheck<T> => {
  const [check, setCheck] = useState<DebouncedCheck<T>>({ status: 'idle' });
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    if (key === null) {
      setCheck({ status: 'idle' });
      return;
    }
    let isCurrent = true;
    setCheck({ status: 'checking' });
    const timer = window.setTimeout(() => {
      runRef
        .current()
        .then((value) => {
          if (isCurrent) {
            setCheck({ status: 'ok', value });
          }
        })
        .catch((error: unknown) => {
          if (isCurrent) {
            setCheck({ status: 'error', error: formatError(error) });
          }
        });
    }, delayMs);
    return () => {
      isCurrent = false;
      window.clearTimeout(timer);
    };
  }, [key, delayMs]);

  return check;
};
