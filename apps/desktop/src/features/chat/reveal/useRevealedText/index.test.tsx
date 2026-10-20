import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextProviderRunId } from '@goodboy/types/testing';
import { liveTextRegistry } from '../liveTextRegistry';
import { revealPacer } from '../revealPacer';
import { useRevealedText } from './index';

const RUN = nextProviderRunId();
const ITEM = 'text-4';
const LONG = Array.from({ length: 200 }, (_, index) => `word${index}`).join(' ');

type HookProps = {
  readonly text: string;
  readonly isComplete: boolean;
};

const mountHook = (initial: HookProps) =>
  renderHook((props: HookProps) => useRevealedText({ runId: RUN, itemKey: ITEM, ...props }), {
    initialProps: initial,
  });

const setReducedMotion = (isReduced: boolean): void => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: isReduced && query.includes('reduce'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
};

describe('useRevealedText', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    liveTextRegistry.clear();
    revealPacer.reset();
    setReducedMotion(false);
  });

  afterEach(() => {
    revealPacer.reset();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('shows text that never streamed in this window whole, at once', () => {
    const { result } = mountHook({ text: LONG, isComplete: true });
    expect(result.current.text).toBe(LONG);
    expect(result.current.isRevealing).toBe(false);
    expect(result.current.pieces).toEqual([]);
  });

  it('shows text whole when the host mounts after the live window closed', () => {
    liveTextRegistry.mark({ runId: RUN });
    vi.advanceTimersByTime(2000);
    const { result } = mountHook({ text: LONG, isComplete: true });
    expect(result.current.text).toBe(LONG);
  });

  it('writes live text in from nothing and ends with the full text', () => {
    liveTextRegistry.mark({ runId: RUN });
    const { result } = mountHook({ text: LONG, isComplete: true });
    expect(result.current.text).toBe('');
    expect(result.current.isRevealing).toBe(true);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.text.length).toBeGreaterThan(0);
    expect(result.current.text.length).toBeLessThan(LONG.length);
    expect(LONG.startsWith(result.current.text)).toBe(true);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.text).toBe(LONG);
    expect(result.current.isRevealing).toBe(false);
  });

  it('shows live text at once under reduced motion', () => {
    setReducedMotion(true);
    liveTextRegistry.mark({ runId: RUN });
    const { result } = mountHook({ text: LONG, isComplete: true });
    expect(result.current.text).toBe(LONG);
    expect(result.current.isRevealing).toBe(false);
  });

  it('finish shows the full text at once', () => {
    liveTextRegistry.mark({ runId: RUN });
    const { result } = mountHook({ text: LONG, isComplete: true });
    act(() => {
      result.current.finish();
    });
    expect(result.current.text).toBe(LONG);
  });

  it('animates only the growth that came live on a text mounted from history', () => {
    const history = 'alpha beta gamma ';
    const { result, rerender } = mountHook({ text: history, isComplete: false });
    expect(result.current.text).toBe(history);
    liveTextRegistry.mark({ runId: RUN });
    rerender({ text: `${history}${LONG}`, isComplete: true });
    expect(result.current.text.startsWith(history.trimEnd())).toBe(true);
    expect(result.current.text.length).toBeLessThan(history.length + LONG.length);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.text).toBe(`${history}${LONG}`);
  });

  it('growth that did not come live shows at once', () => {
    const { result, rerender } = mountHook({ text: 'alpha beta ', isComplete: false });
    rerender({ text: `alpha beta ${LONG}`, isComplete: true });
    expect(result.current.text).toBe(`alpha beta ${LONG}`);
  });

  it('releases its pacer entry on unmount', () => {
    liveTextRegistry.mark({ runId: RUN });
    const { unmount } = mountHook({ text: LONG, isComplete: true });
    expect(revealPacer.snapshotOf({ key: `${RUN}:${ITEM}` })).not.toBeNull();
    unmount();
    expect(revealPacer.snapshotOf({ key: `${RUN}:${ITEM}` })).toBeNull();
  });
});
