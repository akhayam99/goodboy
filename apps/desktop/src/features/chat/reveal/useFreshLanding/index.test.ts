// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { liveTextRegistry } from '../liveTextRegistry';
import { useFreshLanding } from './index';

const LIVE_KEY = 'workflow-run-northwind';

type HookProps = {
  readonly text: string;
};

const renderLanding = ({ text }: HookProps) =>
  renderHook((props: HookProps) => useFreshLanding({ liveKey: LIVE_KEY, text: props.text }), {
    initialProps: { text },
  });

beforeEach(() => {
  liveTextRegistry.clear();
});

afterEach(() => {
  liveTextRegistry.clear();
});

describe('useFreshLanding', () => {
  it('shows a loaded text without a fade', () => {
    const { result } = renderLanding({ text: 'Done: ledger-core retries.' });

    expect(result.current.fade).toBeUndefined();
  });

  it('fades text that lands while its source is live, with a new key', () => {
    const { result, rerender } = renderLanding({ text: '' });
    const before = result.current.fadeKey;
    liveTextRegistry.mark({ runId: LIVE_KEY });

    rerender({ text: 'Done: ledger-core retries.' });

    expect(result.current.fade?.['data-fresh']).toBe('');
    expect(result.current.fadeKey).not.toBe(before);
  });

  it('keeps a change that is not live still', () => {
    const { result, rerender } = renderLanding({ text: 'Done: ledger-core retries.' });

    rerender({ text: 'Done: ledger-core and notify-relay retries.' });

    expect(result.current.fade).toBeUndefined();
  });

  it('fades a block that mounts when the reveal of its live text ends', () => {
    vi.useFakeTimers();
    liveTextRegistry.mark({ runId: LIVE_KEY });
    vi.advanceTimersByTime(1900);

    const { result } = renderLanding({ text: 'Done: ledger-core retries.' });

    expect(result.current.fade).toBeDefined();
    vi.useRealTimers();
  });

  it('shows a block whole once the landing window is over', () => {
    vi.useFakeTimers();
    liveTextRegistry.mark({ runId: LIVE_KEY });
    vi.advanceTimersByTime(2500);

    const { result } = renderLanding({ text: 'Done: ledger-core retries.' });

    expect(result.current.fade).toBeUndefined();
    vi.useRealTimers();
  });

  it('never fades a host without a live key', () => {
    liveTextRegistry.mark({ runId: LIVE_KEY });

    const { result } = renderHook(() =>
      useFreshLanding({ liveKey: null, text: 'Done: ledger-core retries.' }),
    );

    expect(result.current.fade).toBeUndefined();
  });

  it('fades a text that mounts inside the live window', () => {
    liveTextRegistry.mark({ runId: LIVE_KEY });

    const { result } = renderLanding({ text: 'Done: ledger-core retries.' });

    expect(result.current.fade).toBeDefined();
  });
});
