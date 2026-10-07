// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { STORAGE_KEYS } from '../../../../shared/lib/storage-keys';
import { clampTreeWidth, TREE_WIDTH_MAX, TREE_WIDTH_MIN, useTreeWidth } from '.';

describe('clampTreeWidth', () => {
  it('keeps a width inside the bounds', () => {
    expect(clampTreeWidth({ width: 320, paneWidth: 1920 })).toBe(320);
  });

  it('never goes below 240', () => {
    expect(TREE_WIDTH_MIN).toBe(240);
    expect(clampTreeWidth({ width: 100, paneWidth: 1920 })).toBe(TREE_WIDTH_MIN);
  });

  it('never goes above 400, however wide the pane', () => {
    expect(TREE_WIDTH_MAX).toBe(400);
    expect(clampTreeWidth({ width: 900, paneWidth: 3000 })).toBe(TREE_WIDTH_MAX);
  });

  it('stops at what still docks in the left margin, the margin less 24px', () => {
    expect(clampTreeWidth({ width: 400, paneWidth: 1700 })).toBe(322);
    expect(clampTreeWidth({ width: 400, paneWidth: 1617 })).toBe(280);
  });

  it('keeps the minimum where the margin holds less than that', () => {
    expect(clampTreeWidth({ width: 400, paneWidth: 1200 })).toBe(TREE_WIDTH_MIN);
    expect(clampTreeWidth({ width: 400, paneWidth: 500 })).toBe(TREE_WIDTH_MIN);
  });

  it('reads an unmeasured pane as wide enough for the largest rail', () => {
    expect(clampTreeWidth({ width: 900, paneWidth: Number.POSITIVE_INFINITY })).toBe(
      TREE_WIDTH_MAX,
    );
  });
});

describe('useTreeWidth', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('starts at 280 when nothing was saved', () => {
    expect(renderHook(() => useTreeWidth()).result.current.width).toBe(280);
  });

  it('keeps the saved width under the same key as before', () => {
    localStorage.setItem(STORAGE_KEYS.diffTreeWidth, '360');

    expect(renderHook(() => useTreeWidth()).result.current.width).toBe(360);
  });

  it('saves the clamped width a drag ends on', () => {
    const { result } = renderHook(() => useTreeWidth());

    act(() => result.current.resizeTo({ width: 900, paneWidth: 1700 }));

    expect(result.current.width).toBe(322);
    expect(localStorage.getItem(STORAGE_KEYS.diffTreeWidth)).toBe('322');
  });
});
