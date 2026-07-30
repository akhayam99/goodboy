import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { useMessageQueue } from './useMessageQueue';
import type { QueuedTurn } from '../lib';

const AGENT = 'agent-1' as AgentId;
const OTHER_AGENT = 'agent-2' as AgentId;

const makeTurn = (id: string, content = 'hi'): QueuedTurn => ({
  id,
  agentId: AGENT,
  content,
  attachments: [],
  override: undefined,
});

const noop = () => {};
const resolved = () => Promise.resolve();

beforeEach(() => {
  useAppStore.setState({ agentQueue: {} });
});

describe('useMessageQueue', () => {
  it('enqueues turns in order', () => {
    const { result } = renderHook(() =>
      useMessageQueue({ agentId: AGENT, isRunning: true, dispatchTurn: resolved, onEdit: noop }),
    );
    act(() => {
      result.current.enqueue(makeTurn('t1'));
      result.current.enqueue(makeTurn('t2'));
    });
    expect(result.current.queue.map((q) => q.id)).toEqual(['t1', 't2']);
  });

  it('persists the queue in the store keyed by agent', () => {
    const { result } = renderHook(() =>
      useMessageQueue({ agentId: AGENT, isRunning: true, dispatchTurn: resolved, onEdit: noop }),
    );
    act(() => {
      result.current.enqueue(makeTurn('t1'));
    });
    expect(useAppStore.getState().agentQueue[AGENT]?.map((q) => q.id)).toEqual(['t1']);
  });

  it('captures the queued agent and routing override', () => {
    const override = { providerId: 'anthropic', model: 'claude-opus-5' } as const;
    const { result } = renderHook(() =>
      useMessageQueue({ agentId: AGENT, isRunning: true, dispatchTurn: resolved, onEdit: noop }),
    );
    act(() => {
      result.current.enqueue({ ...makeTurn('t1'), override });
    });
    expect(useAppStore.getState().agentQueue[AGENT]?.[0]).toEqual(
      expect.objectContaining({ agentId: AGENT, override }),
    );
  });

  it('removes a queued turn by id', () => {
    const { result } = renderHook(() =>
      useMessageQueue({ agentId: AGENT, isRunning: true, dispatchTurn: resolved, onEdit: noop }),
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
      useMessageQueue({ agentId: AGENT, isRunning: true, dispatchTurn: resolved, onEdit: noop }),
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
      useMessageQueue({ agentId: AGENT, isRunning: true, dispatchTurn: resolved, onEdit }),
    );
    act(() => {
      result.current.enqueue(makeTurn('t1', 'edit me'));
    });
    act(() => {
      result.current.editQueued('t1');
    });
    expect(onEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 't1',
        agentId: AGENT,
        content: 'edit me',
      }),
    );
    expect(result.current.queue).toEqual([]);
  });

  it('hands the captured override back to the composer on edit', () => {
    const onEdit = vi.fn();
    const override = { providerId: 'cursor', model: 'composer-2.5' } as const;
    const { result } = renderHook(() =>
      useMessageQueue({ agentId: AGENT, isRunning: true, dispatchTurn: resolved, onEdit }),
    );
    act(() => {
      result.current.enqueue({ ...makeTurn('t1'), override });
      result.current.editQueued('t1');
    });
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ override }));
  });

  it('ignores edit for an unknown id', () => {
    const onEdit = vi.fn();
    const { result } = renderHook(() =>
      useMessageQueue({ agentId: AGENT, isRunning: true, dispatchTurn: resolved, onEdit }),
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
      ({ isRunning }) => useMessageQueue({ agentId: AGENT, isRunning, dispatchTurn, onEdit: noop }),
      { initialProps: { isRunning: true } },
    );
    act(() => {
      result.current.enqueue(makeTurn('t1', 'queued'));
    });
    rerender({ isRunning: false });
    expect(dispatchTurn).toHaveBeenCalledWith('queued', [], undefined, AGENT);
    expect(result.current.queue).toEqual([]);
  });

  it('dispatches the exact routing override captured by the queued turn', () => {
    const dispatchTurn = vi.fn().mockResolvedValue(undefined);
    const override = {
      providerId: 'anthropic',
      model: 'claude-opus-5',
      selection: { key: 'opus-5', effort: 'xhigh' },
    } as const;
    const { result, rerender } = renderHook(
      ({ isRunning }) => useMessageQueue({ agentId: AGENT, isRunning, dispatchTurn, onEdit: noop }),
      { initialProps: { isRunning: true } },
    );
    act(() => {
      result.current.enqueue({ ...makeTurn('t1', 'queued with override'), override });
    });

    rerender({ isRunning: false });

    expect(dispatchTurn).toHaveBeenCalledWith('queued with override', [], override, AGENT);
    expect(dispatchTurn.mock.calls[0]?.[2]).toBe(override);
  });

  it('dispatches to the agent captured by the queued turn', () => {
    const dispatchTurn = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      ({ isRunning }) => useMessageQueue({ agentId: AGENT, isRunning, dispatchTurn, onEdit: noop }),
      { initialProps: { isRunning: true } },
    );
    act(() => {
      result.current.enqueue({
        ...makeTurn('t1', 'queued for another agent'),
        agentId: OTHER_AGENT,
      });
    });

    rerender({ isRunning: false });

    expect(dispatchTurn).toHaveBeenCalledWith(
      'queued for another agent',
      [],
      undefined,
      OTHER_AGENT,
    );
  });

  it('holds turns queued while idle without a running-to-idle transition', () => {
    const dispatchTurn = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useMessageQueue({ agentId: AGENT, isRunning: false, dispatchTurn, onEdit: noop }),
    );
    act(() => {
      result.current.enqueue(makeTurn('t1'));
    });
    expect(dispatchTurn).not.toHaveBeenCalled();
    expect(result.current.queue.map((q) => q.id)).toEqual(['t1']);
  });

  it('keeps separate queues per agent', () => {
    const { result, rerender } = renderHook(
      ({ agentId }) =>
        useMessageQueue({ agentId, isRunning: true, dispatchTurn: resolved, onEdit: noop }),
      { initialProps: { agentId: AGENT } },
    );
    act(() => {
      result.current.enqueue(makeTurn('a'));
    });
    rerender({ agentId: OTHER_AGENT });
    expect(result.current.queue).toEqual([]);
    act(() => {
      result.current.enqueue(makeTurn('b'));
    });
    expect(result.current.queue.map((q) => q.id)).toEqual(['b']);
    rerender({ agentId: AGENT });
    expect(result.current.queue.map((q) => q.id)).toEqual(['a']);
  });
});
