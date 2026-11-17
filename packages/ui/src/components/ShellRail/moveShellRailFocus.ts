import type { KeyboardEvent } from 'react';

type Params = {
  readonly event: KeyboardEvent<HTMLElement>;
};

type IndexParams = {
  readonly key: string;
  readonly from: number;
  readonly count: number;
};

const ITEM_SELECTOR = '[data-shell-rail-item]:not(:disabled)';

const railIndexAfter = ({ key, from, count }: IndexParams): number | null => {
  if (key === 'ArrowDown') {
    return (from + 1) % count;
  }
  if (key === 'ArrowUp') {
    return (from - 1 + count) % count;
  }
  if (key === 'Home') {
    return 0;
  }
  if (key === 'End') {
    return count - 1;
  }
  return null;
};

export const moveShellRailFocus = ({ event }: Params): void => {
  if (event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey) {
    return;
  }
  const items = [...event.currentTarget.querySelectorAll<HTMLElement>(ITEM_SELECTOR)];
  const from = items.findIndex((item) => item === event.target);
  if (from === -1) {
    return;
  }
  const next = railIndexAfter({ key: event.key, from, count: items.length });
  if (next === null) {
    return;
  }
  event.preventDefault();
  items[next]?.focus();
};
