// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { OTHER_TOOL_COLUMN } from './otherToolColumns';

describe('OTHER_TOOL_COLUMN', () => {
  it('keeps the size and the session count on one line with figures that line up', () => {
    for (const cell of [OTHER_TOOL_COLUMN.count, OTHER_TOOL_COLUMN.size]) {
      expect(cell.split(' ')).toContain('whitespace-nowrap');
      expect(cell.split(' ')).toContain('tabular-nums');
    }
  });

  it('gives the count and the size bar a fixed track so every row shares one edge', () => {
    expect(OTHER_TOOL_COLUMN.grid).toContain('_96px_220px_');
    expect(OTHER_TOOL_COLUMN.grid).not.toContain('minmax(0,220px)');
    expect(OTHER_TOOL_COLUMN.grid).not.toContain('_auto_');
  });
});
