import { describe, expect, it } from 'vitest';
import { historyAfterLayout } from './historyAfterLayout';

const rows = new Map([
  ['a', 400],
  ['b', 330],
  ['c', 260],
  ['d', 190],
]);

describe('history after layout', () => {
  it('keeps an unchanged commit level with its own row', () => {
    const positions = historyAfterLayout({
      keep: ['a', 'b', 'c', 'd'],
      rowY: rows,
      forkY: 470,
      topY: 60,
    });
    expect([...positions.values()]).toEqual([400, 330, 260, 190]);
  });

  it('pushes only the neighbours a moved commit crowds', () => {
    const positions = historyAfterLayout({
      keep: ['a', 'c', 'b', 'd'],
      rowY: rows,
      forkY: 470,
      topY: 60,
    });
    expect(positions.get('a')).toBe(400);
    expect(positions.get('c')).toBe(260);
    expect(positions.get('b')).toBe(216);
    expect(positions.get('d')).toBe(172);
  });

  it('falls back to even spacing when the nodes do not fit above the fork', () => {
    const positions = historyAfterLayout({
      keep: ['d', 'c', 'b', 'a'],
      rowY: rows,
      forkY: 200,
      topY: 100,
    });
    const ys = [...positions.values()];
    expect(ys.every((y) => y > 100 && y < 200)).toBe(true);
    expect(ys[0]).toBeGreaterThan(ys[3] ?? 0);
  });
});
