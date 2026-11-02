// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { ListItemMotion } from '../components/ListItemMotion';
import { DURATION_BASE_MS, DURATION_QUICK_MS } from '../motionTimings';
import { LIST_MOTION_MAX_BATCH, useListMotion, type ListMotionItem } from '../useListMotion';

type HookProps = {
  readonly items: ReadonlyArray<ListMotionItem<string>>;
  readonly resetKey: string;
};

const itemsOf = ({ keys }: { readonly keys: ReadonlyArray<string> }) =>
  keys.map((key) => ({ key, value: `card ${key}` }));

const keysOf = ({ count }: { readonly count: number }) =>
  Array.from({ length: count }, (_, index) => `s${index}`);

const advance = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

const stubReducedMotion = ({ isReduced }: { readonly isReduced: boolean }) => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: isReduced && query.includes('reduce'),
    media: query,
  }));
};

const mount = (initial: HookProps) =>
  renderHook((props: HookProps) => useListMotion(props), { initialProps: initial });

const phasesOf = ({
  entries,
}: {
  readonly entries: ReadonlyArray<{ readonly key: string; readonly phase: string }>;
}) => entries.map((entry) => `${entry.key}:${entry.phase}`);

beforeEach(() => {
  vi.useFakeTimers();
  stubReducedMotion({ isReduced: false });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useListMotion', () => {
  it('draws the first list stable', () => {
    const { result } = mount({ items: itemsOf({ keys: ['a', 'b'] }), resetKey: 'all' });

    expect(phasesOf({ entries: result.current })).toEqual(['a:stable', 'b:stable']);
  });

  it('draws a silent key stable on arrival and drops it at once on exit', () => {
    const silentKeys = new Set(['b']);
    const { result, rerender } = renderHook(
      (props: HookProps) => useListMotion({ ...props, silentKeys }),
      { initialProps: { items: itemsOf({ keys: ['a'] }), resetKey: 'all' } },
    );

    rerender({ items: itemsOf({ keys: ['a', 'b'] }), resetKey: 'all' });
    expect(phasesOf({ entries: result.current })).toEqual(['a:stable', 'b:stable']);

    rerender({ items: itemsOf({ keys: ['a'] }), resetKey: 'all' });
    expect(phasesOf({ entries: result.current })).toEqual(['a:stable']);
  });

  it('enters an added card for 200 ms and then rests', () => {
    const { result, rerender } = mount({ items: itemsOf({ keys: ['a', 'b'] }), resetKey: 'all' });

    rerender({ items: itemsOf({ keys: ['c', 'a', 'b'] }), resetKey: 'all' });
    expect(phasesOf({ entries: result.current })).toEqual(['c:entering', 'a:stable', 'b:stable']);

    advance(DURATION_BASE_MS);
    expect(phasesOf({ entries: result.current })).toEqual(['c:stable', 'a:stable', 'b:stable']);
  });

  it('keeps a removed card in place, fades it, collapses it and drops it', () => {
    const { result, rerender } = mount({
      items: itemsOf({ keys: ['a', 'b', 'c'] }),
      resetKey: 'all',
    });

    rerender({ items: itemsOf({ keys: ['a', 'c'] }), resetKey: 'all' });
    expect(phasesOf({ entries: result.current })).toEqual(['a:stable', 'b:leaving', 'c:stable']);

    advance(DURATION_QUICK_MS);
    expect(phasesOf({ entries: result.current })).toEqual(['a:stable', 'b:collapsing', 'c:stable']);

    advance(DURATION_BASE_MS);
    expect(phasesOf({ entries: result.current })).toEqual(['a:stable', 'c:stable']);
  });

  it('never animates a batch over 20', () => {
    const { result, rerender } = mount({ items: itemsOf({ keys: ['a'] }), resetKey: 'all' });

    rerender({
      items: itemsOf({ keys: keysOf({ count: LIST_MOTION_MAX_BATCH + 1 }) }),
      resetKey: 'all',
    });

    expect(result.current.every((entry) => entry.phase === 'stable')).toBe(true);
    expect(result.current).toHaveLength(LIST_MOTION_MAX_BATCH + 1);
  });

  it('does not animate when the filter changed', () => {
    const { result, rerender } = mount({ items: itemsOf({ keys: ['a', 'b'] }), resetKey: 'all' });

    rerender({ items: itemsOf({ keys: ['b'] }), resetKey: 'payments-api' });

    expect(phasesOf({ entries: result.current })).toEqual(['b:stable']);
  });

  it('does not animate under reduced motion', () => {
    stubReducedMotion({ isReduced: true });
    const { result, rerender } = mount({ items: itemsOf({ keys: ['a'] }), resetKey: 'all' });

    rerender({ items: itemsOf({ keys: ['a', 'b'] }), resetKey: 'all' });

    expect(phasesOf({ entries: result.current })).toEqual(['a:stable', 'b:stable']);
  });

  it('brings a card back stable when it returns while it is leaving', () => {
    const { result, rerender } = mount({ items: itemsOf({ keys: ['a', 'b'] }), resetKey: 'all' });

    rerender({ items: itemsOf({ keys: ['a'] }), resetKey: 'all' });
    rerender({ items: itemsOf({ keys: ['a', 'b'] }), resetKey: 'all' });

    expect(phasesOf({ entries: result.current })).toEqual(['a:stable', 'b:entering']);
  });
});

describe('ListItemMotion', () => {
  it('adds no wrapper box while stable and inerts a leaving card', () => {
    const { rerender, container } = render(
      <ListItemMotion phase="stable">
        <p>Ledger-core export</p>
      </ListItemMotion>,
    );
    expect(container.querySelector('[data-list-motion]')?.className).toBe('contents');

    rerender(
      <ListItemMotion phase="leaving">
        <p>Ledger-core export</p>
      </ListItemMotion>,
    );

    const frame = container.querySelector('[data-list-motion]');
    expect(frame?.hasAttribute('inert')).toBe(true);
    expect(frame?.className).toContain('grid-rows-[1fr]');
    screen.getByText('Ledger-core export');

    rerender(
      <ListItemMotion phase="collapsing">
        <p>Ledger-core export</p>
      </ListItemMotion>,
    );
    expect(container.querySelector('[data-list-motion]')?.className).toContain('grid-rows-[0fr]');
  });

  it('opens an entering card from zero height', () => {
    const { container } = render(
      <ListItemMotion phase="entering">
        <p>Notify-relay retry</p>
      </ListItemMotion>,
    );

    expect(container.querySelector('[data-list-motion]')?.className).toContain('grid-rows-[1fr]');
    expect(container.querySelector('.animate-pane-in, [class*="animate-pane-in"]')).not.toBeNull();
  });
});
