import { describe, expect, it } from 'vitest';
import { TOAST_GUTTER_PX, toastRightOf } from './toastRightOf';

describe('toastRightOf', () => {
  it.each([
    ['closed', 0, 12],
    ['closed', 400, 12],
    ['overlay', 520, 12],
    ['push', 396, 408],
    ['push', 400.4, 412],
    ['push', 0, 12],
  ] as const)('%s drawer %s wide puts the stack %s from the right', (mode, drawerWidth, right) => {
    expect(toastRightOf({ mode, drawerWidth })).toBe(right);
  });

  it('uses the page gutter of 12px', () => {
    expect(TOAST_GUTTER_PX).toBe(12);
  });
});
