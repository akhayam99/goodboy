import { beforeEach } from 'vitest';

const WIDE_WINDOW = 1440;

beforeEach(() => {
  if (typeof window === 'undefined') {
    return;
  }
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: WIDE_WINDOW,
  });
});
