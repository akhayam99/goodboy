// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { historyGraphHeight } from './historyGraphHeight';

describe('historyGraphHeight', () => {
  it('ends at the bottom of the last row', () => {
    expect(
      historyGraphHeight({
        boxes: [
          { top: 0, height: 48 },
          { top: 48, height: 56 },
          { top: 104, height: 48 },
        ],
      }),
    ).toBe(152);
  });

  it('shrinks when the rows do', () => {
    const before = historyGraphHeight({
      boxes: Array.from({ length: 26 }, (_, index) => ({ top: index * 56, height: 56 })),
    });
    const after = historyGraphHeight({
      boxes: [
        { top: 0, height: 56 },
        { top: 56, height: 48 },
      ],
    });
    expect(after).toBeLessThan(before);
    expect(after).toBe(104);
  });

  it('is zero with no rows', () => {
    expect(historyGraphHeight({ boxes: [] })).toBe(0);
  });
});
