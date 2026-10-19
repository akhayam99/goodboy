import { describe, expect, it } from 'vitest';
import { treeKeyTargetOf } from './treeKeyTargetOf';

const LEVELS: ReadonlyArray<number> = [1, 2, 2, 3, 1, 2];

describe('treeKeyTargetOf', () => {
  it.each([
    ['ArrowDown', 0, 1],
    ['ArrowDown', 5, 5],
    ['ArrowUp', 0, 0],
    ['ArrowUp', 3, 2],
    ['Home', 4, 0],
    ['End', 1, 5],
    ['ArrowRight', 2, 3],
    ['ArrowRight', 3, null],
    ['ArrowLeft', 3, 2],
    ['ArrowLeft', 5, 4],
    ['ArrowLeft', 0, null],
    ['Tab', 1, null],
  ] as const)('moves %s from row %i to %s', (key, from, target) => {
    expect(treeKeyTargetOf({ key, levels: LEVELS, from })).toBe(target);
  });

  it('moves nowhere in an empty tree', () => {
    expect(treeKeyTargetOf({ key: 'ArrowDown', levels: [], from: 0 })).toBeNull();
  });
});
