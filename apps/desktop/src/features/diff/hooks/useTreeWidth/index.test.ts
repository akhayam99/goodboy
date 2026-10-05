import { describe, expect, it } from 'vitest';
import { clampTreeWidth, TREE_WIDTH_MAX, TREE_WIDTH_MIN } from '.';

describe('clampTreeWidth', () => {
  it('keeps a width inside the bounds', () => {
    expect(clampTreeWidth(320, 1440)).toBe(320);
  });

  it('never goes below the minimum', () => {
    expect(clampTreeWidth(100, 1440)).toBe(TREE_WIDTH_MIN);
  });

  it('caps at 30% of the pane', () => {
    expect(clampTreeWidth(500, 1000)).toBe(300);
  });

  it('caps at the absolute maximum on wide panes', () => {
    expect(clampTreeWidth(900, 3000)).toBe(TREE_WIDTH_MAX);
  });

  it('keeps the minimum on tiny panes', () => {
    expect(clampTreeWidth(400, 500)).toBe(TREE_WIDTH_MIN);
  });
});
