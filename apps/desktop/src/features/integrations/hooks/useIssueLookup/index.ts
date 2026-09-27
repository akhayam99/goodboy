import { useEffect, useRef, useState } from 'react';

const DEBOUNCE_MS = 300;
const CACHE_MS = 2 * 60 * 1000;

export type IssueLookupState<T> =
  | { readonly status: 'idle' }
  | { readonly status: 'loading'; readonly key: string }
  | { readonly status: 'done'; readonly key: string; readonly value: T };

type CacheEntry<T> = {
  readonly value: T;
  readonly at: number;
};

type Params<T> = {
  readonly key: string | null;
  readonly scope: string;
  readonly immediate?: boolean;
  readonly run: (params: { readonly signal: AbortSignal }) => Promise<T>;
  readonly now?: () => number;
};

const caches = new Map<string, Map<string, CacheEntry<unknown>>>();

const cacheFor = (scope: string): Map<string, CacheEntry<unknown>> => {
  const existing = caches.get(scope);
  if (existing !== undefined) {
    return existing;
  }
  const created = new Map<string, CacheEntry<unknown>>();
  caches.set(scope, created);
  return created;
};

export const forgetIssueLookups = (): void => {
  caches.clear();
};

export const useIssueLookup = <T>({
  key,
  scope,
  immediate = false,
  run,
  now = Date.now,
}: Params<T>): IssueLookupState<T> => {
  const [state, setState] = useState<IssueLookupState<T>>({ status: 'idle' });
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    if (key === null) {
      setState({ status: 'idle' });
      return;
    }
    const cache = cacheFor(scope);
    const cached = cache.get(key);
    if (cached !== undefined && now() - cached.at < CACHE_MS) {
      setState({ status: 'done', key, value: cached.value as T });
      return;
    }
    const controller = new AbortController();
    setState({ status: 'loading', key });
    const start = () => {
      void runRef
        .current({ signal: controller.signal })
        .then((value) => {
          if (controller.signal.aborted) {
            return;
          }
          cache.set(key, { value, at: now() });
          setState({ status: 'done', key, value });
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setState({ status: 'idle' });
          }
        });
    };
    const timer = immediate ? null : setTimeout(start, DEBOUNCE_MS);
    if (immediate) {
      start();
    }
    return () => {
      controller.abort();
      if (timer !== null) {
        clearTimeout(timer);
      }
    };
  }, [key, scope, immediate]);

  return state;
};
