import { describe, expect, it } from 'vitest';
import {
  briefInventoryRow,
  countCutRows,
  keptRowState,
  replaceInventoryRow,
  sizeInventoryRow,
} from './artifactContextInventory';

describe('artifact context inventory', () => {
  it('marks a section partial when the builder kept fewer than it had', () => {
    expect(keptRowState({ kept: 12, total: 30 })).toBe('partial');
    expect(keptRowState({ kept: 4, total: 4 })).toBe('included');
    expect(keptRowState({ kept: 0, total: 0 })).toBe('missing');
  });

  it('says the brief is missing when nothing was typed', () => {
    expect(briefInventoryRow({ brief: '   ' }).state).toBe('missing');
    expect(briefInventoryRow({ brief: 'draw the release queue' }).summary).toContain(
      '22 characters',
    );
  });

  it('flags the size row once the pack goes over the cap', () => {
    const row = sizeInventoryRow({ size: 52_000, cap: 48_000, isCapped: true });
    expect(row.state).toBe('partial');
    expect(row.summary).toBe('about 52,000 of 48,000 characters');
  });

  it('counts only the rows that were cut short', () => {
    const rows = [
      briefInventoryRow({ brief: 'x' }),
      sizeInventoryRow({ size: 10, cap: 20, isCapped: false }),
      { ...sizeInventoryRow({ size: 30, cap: 20, isCapped: true }), id: 'agents' as const },
    ];
    expect(countCutRows({ rows })).toBe(1);
  });

  it('replaces a row in place by id', () => {
    const rows = [briefInventoryRow({ brief: '' })];
    const next = replaceInventoryRow({ rows, row: briefInventoryRow({ brief: 'a brief' }) });
    expect(next[0]?.state).toBe('included');
  });
});
