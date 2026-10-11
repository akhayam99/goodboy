import { useCallback, useEffect, useRef } from 'react';

type Params = {
  readonly host: HTMLElement | null;
  readonly open: () => void;
  readonly dismiss: () => void;
};

export type TreeFocus = {
  readonly focus: () => void;
  readonly focusFilter: () => void;
  readonly dismiss: () => void;
};

const TREE_SELECTOR = '[role="tree"]';
const FILTER_SELECTOR = '[data-diff-filter]';

type HostParams = {
  readonly host: HTMLElement;
};

const focusRow = ({ host }: HostParams): void => {
  host.querySelector<HTMLElement>(TREE_SELECTOR)?.focus();
};

const focusFilterField = ({ host }: HostParams): void => {
  host.querySelector<HTMLElement>(FILTER_SELECTOR)?.focus();
};

export const useTreeFocus = ({ host, open, dismiss }: Params): TreeFocus => {
  const pending = useRef<((host: HTMLElement) => void) | null>(null);

  const focusWith = useCallback(
    (target: (host: HTMLElement) => void) => {
      if (host !== null) {
        target(host);
        return;
      }
      pending.current = target;
      open();
    },
    [host, open],
  );

  useEffect(() => {
    if (host === null || pending.current === null) {
      return;
    }
    const target = pending.current;
    pending.current = null;
    target(host);
  }, [host]);

  const focus = useCallback(() => focusWith((node) => focusRow({ host: node })), [focusWith]);
  const focusFilter = useCallback(
    () => focusWith((node) => focusFilterField({ host: node })),
    [focusWith],
  );

  return { focus, focusFilter, dismiss };
};
