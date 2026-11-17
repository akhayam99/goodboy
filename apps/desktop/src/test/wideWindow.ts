import { beforeEach } from 'vitest';

const WIDE_WINDOW = 1440;

beforeEach(() => {
  if (typeof window === 'undefined') {
    return;
  }
  const happy: unknown = Reflect.get(window, 'happyDOM');
  const setViewport: unknown =
    typeof happy === 'object' && happy !== null ? Reflect.get(happy, 'setViewport') : undefined;
  if (typeof setViewport === 'function') {
    Reflect.apply(setViewport, happy, [{ width: WIDE_WINDOW }]);
  }
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: WIDE_WINDOW,
  });
});
