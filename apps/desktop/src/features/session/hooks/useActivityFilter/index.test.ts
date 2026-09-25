// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ACTIVITY_FILTER_PRESETS, DEFAULT_ACTIVITY_FILTER } from '../../timeline/activityFilter';
import { useActivityFilter } from './index';

const STORAGE_KEY = 'goodboy:activity-filter';

beforeEach(() => {
  localStorage.clear();
});

describe('useActivityFilter', () => {
  it('starts on Everything with nothing hidden', () => {
    const { result } = renderHook(() => useActivityFilter());

    expect(result.current.preset).toBe('everything');
    expect(result.current.hidden).toEqual([]);
    expect(result.current.isNeedsYou).toBe(false);
  });

  it('applies and persists the Work preset', () => {
    const { result } = renderHook(() => useActivityFilter());

    act(() => result.current.applyPreset({ preset: 'work' }));

    expect(result.current.preset).toBe('work');
    expect(result.current.filter).toEqual(ACTIVITY_FILTER_PRESETS.work);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual(
      ACTIVITY_FILTER_PRESETS.work,
    );
  });

  it('holds Needs you for this view only and leaves the stored filter alone', () => {
    const { result } = renderHook(() => useActivityFilter());

    act(() => result.current.applyPreset({ preset: 'needsYou' }));

    expect(result.current.preset).toBe('needsYou');
    expect(result.current.isNeedsYou).toBe(true);
    expect(result.current.filter).toEqual(DEFAULT_ACTIVITY_FILTER);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('leaves Needs you as soon as one toggle changes', () => {
    const { result } = renderHook(() => useActivityFilter());

    act(() => result.current.applyPreset({ preset: 'needsYou' }));
    act(() => result.current.setToggle({ toggle: 'decisions', enabled: false }));

    expect(result.current.isNeedsYou).toBe(false);
    expect(result.current.preset).toBeNull();
    expect(result.current.hidden).toEqual(['decisions']);
  });
});
