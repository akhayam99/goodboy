// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { EntryWash } from '../components/EntryWash';
import { DURATION_QUICK_MS } from '../motionTimings';
import { useEntryWash } from '../useEntryWash';

type HookProps = {
  readonly keys: ReadonlyArray<string>;
};

const stubReducedMotion = ({ isReduced }: { readonly isReduced: boolean }) => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: isReduced && query.includes('reduce'),
    media: query,
  }));
};

const mount = (initial: HookProps) =>
  renderHook((props: HookProps) => useEntryWash(props), { initialProps: initial });

beforeEach(() => {
  vi.useFakeTimers();
  stubReducedMotion({ isReduced: false });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useEntryWash', () => {
  it('washes nothing on the first render', () => {
    const { result } = mount({ keys: ['a', 'b'] });

    expect([...result.current]).toEqual([]);
  });

  it('washes a key that arrives once and then lets it go', () => {
    const { result, rerender } = mount({ keys: ['a'] });

    rerender({ keys: ['a', 'b'] });
    expect([...result.current]).toEqual(['b']);

    act(() => {
      vi.advanceTimersByTime(DURATION_QUICK_MS);
    });
    expect([...result.current]).toEqual([]);
  });

  it('never washes a key again on a re-render with the same keys', () => {
    const { result, rerender } = mount({ keys: ['a'] });
    rerender({ keys: ['a', 'b'] });
    act(() => {
      vi.advanceTimersByTime(DURATION_QUICK_MS);
    });

    rerender({ keys: ['a', 'b'] });
    rerender({ keys: ['b', 'a'] });

    expect([...result.current]).toEqual([]);
  });

  it('washes a key that leaves and arrives again', () => {
    const { result, rerender } = mount({ keys: ['a', 'b'] });
    rerender({ keys: ['a'] });

    rerender({ keys: ['a', 'b'] });

    expect([...result.current]).toEqual(['b']);
  });

  it('washes nothing with reduced motion', () => {
    stubReducedMotion({ isReduced: true });
    const { result, rerender } = mount({ keys: ['a'] });

    rerender({ keys: ['a', 'b'] });

    expect([...result.current]).toEqual([]);
  });
});

describe('EntryWash', () => {
  it('tints while washed and clears when it is not', () => {
    const { rerender } = render(
      <EntryWash isWashed>
        <span>row</span>
      </EntryWash>,
    );
    expect(screen.getByText('row').parentElement?.dataset.entryWash).toBe('on');

    rerender(
      <EntryWash isWashed={false}>
        <span>row</span>
      </EntryWash>,
    );
    expect(screen.getByText('row').parentElement?.dataset.entryWash).toBe('off');
  });
});
