import { describe, expect, it } from 'vitest';
import { treeKeyTargetOf } from './treeKeyTargetOf';

const LEVELS: ReadonlyArray<number> = [2, 3, 2, 2, 1, 2, 1];

describe('treeKeyTargetOf, children drawn above their parent as Activity does', () => {
  it.each([
    ['ArrowDown', 0, 1],
    ['ArrowDown', 6, 6],
    ['ArrowUp', 0, 0],
    ['ArrowUp', 3, 2],
    ['Home', 4, 0],
    ['End', 1, 6],
    ['ArrowRight', 2, 1],
    ['ArrowRight', 4, 3],
    ['ArrowRight', 1, null],
    ['ArrowRight', 3, null],
    ['ArrowLeft', 1, 2],
    ['ArrowLeft', 0, 4],
    ['ArrowLeft', 5, 6],
    ['ArrowLeft', 6, null],
    ['Tab', 1, null],
  ] as const)('moves %s from row %i to %s', (key, from, target) => {
    expect(treeKeyTargetOf({ key, levels: LEVELS, from })).toBe(target);
  });

  it('moves nowhere in an empty tree', () => {
    expect(treeKeyTargetOf({ key: 'ArrowDown', levels: [], from: 0 })).toBeNull();
  });
});

describe('treeKeyTargetOf, groups drawn above their rows as the state groups do', () => {
  const GROUPED: ReadonlyArray<number> = [1, 2, 2, 1, 2];

  it.each([
    ['ArrowRight', 0, 1],
    ['ArrowRight', 1, null],
    ['ArrowRight', 3, 4],
    ['ArrowLeft', 2, 0],
    ['ArrowLeft', 4, 3],
    ['ArrowLeft', 0, null],
    ['ArrowDown', 2, 3],
    ['End', 0, 4],
  ] as const)('moves %s from row %i to %s', (key, from, target) => {
    expect(treeKeyTargetOf({ key, levels: GROUPED, from, order: 'parent-first' })).toBe(target);
  });
});
