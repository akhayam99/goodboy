import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useMessageQueue } from './useMessageQueue';
import type { QueuedTurn } from '../lib';

const makeTurn = (id: string, content = 'hi'): QueuedTurn => ({
  id,
  content,
  attachments: [],
  override: undefined,
});

const noop = () => {};
const resolved = () => Promise.resolve();

describe('useMessageQueue', () => {
  it('enqueues turns in order', () => {
    const { result } = renderHook(() =>
      useMessageQueue({ isRunning: true, dispatchTurn: resolved, onEdit: noop }),
    );
    act(() => {
      result.current.enqueue(makeTurn('t1'));
      result.current.enqueue(makeTurn('t2'));
    });
    expect(result.current.queue.map((q) => q.id)).toEqual(['t1', 't2']);
  });

  it('removes a queued turn by id', () => {
    const { result } = renderHook(() =>
      useMessageQueue({ isRunning: true, dispatchTurn: resolved, onEdit: noop }),
    );
    act(() => {
      result.current.enqueue(makeTurn('t1'));
      result.current.enqueue(makeTurn('t2'));
    });
    act(() => {
      result.current.removeQueued('t1');
    });
    expect(result.current.queue.map((q) => q.id)).toEqual(['t2']);
  });

  it('clears the whole queue', () => {
    const { result } = renderHook(() =>
      useMessageQueue({ isRunning: true, dispatchTurn: resolved, onEdit: noop }),
    );
    act(() => {
      result.current.enqueue(makeTurn('t1'));
    });
    act(() => {
      result.current.clearQueue();
    });
    expect(result.current.queue).toEqual([]);
  });

  it('removes the item and hands it to onEdit on edit', () => {
    const onEdit = vi.fn();
    const { result } = renderHook(() =>
      useMessageQueue({ isRunning: true, dispatchTurn: resolved, onEdit }),
    );
    act(() => {
      result.current.enqueue(makeTurn('t1', 'edit me'));
    });
    act(() => {
      result.current.editQueued('t1');
    });
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 't1', content: 'edit me' }));
    expect(result.current.queue).toEqual([]);
  });

  it('ignores edit for an unknown id', () => {
    const onEdit = vi.fn();
    const { result } = renderHook(() =>
      useMessageQueue({ isRunning: true, dispatchTurn: resolved, onEdit }),
    );
    act(() => {
      result.current.enqueue(makeTurn('t1'));
    });
    act(() => {
      result.current.editQueued('nope');
    });
    expect(onEdit).not.toHaveBeenCalled();
    expect(result.current.queue.map((q) => q.id)).toEqual(['t1']);
  });

  it('dispatches the head turn when the agent goes from running to idle', () => {
    const dispatchTurn = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      ({ isRunning }) => useMessageQueue({ isRunning, dispatchTurn, onEdit: noop }),
      { initialProps: { isRunning: true } },
    );
    act(() => {
      result.current.enqueue(makeTurn('t1', 'queued'));
    });
    rerender({ isRunning: false });
    expect(dispatchTurn).toHaveBeenCalledWith('queued', [], undefined);
    expect(result.current.queue).toEqual([]);
  });

  it('holds turns queued while idle without a running-to-idle transition', () => {
    const dispatchTurn = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useMessageQueue({ isRunning: false, dispatchTurn, onEdit: noop }),
    );
    act(() => {
      result.current.enqueue(makeTurn('t1'));
    });
    expect(dispatchTurn).not.toHaveBeenCalled();
    expect(result.current.queue.map((q) => q.id)).toEqual(['t1']);
  });
});
