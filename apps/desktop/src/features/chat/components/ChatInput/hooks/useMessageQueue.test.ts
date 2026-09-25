import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { useMessageQueue } from './useMessageQueue';
import type { QueuedTurn } from '../lib';

const SESSION = 'session-1' as SessionId;
const AGENT = 'agent-1' as AgentId;
const OTHER_AGENT = 'agent-2' as AgentId;

const makeTurn = (id: string, content = 'hi', agentId: AgentId = AGENT): QueuedTurn => ({
  id,
  agentId,
  content,
  attachments: [],
  override: undefined,
});

const noop = () => {};

const render = (agentId: AgentId = AGENT, onEdit: (item: QueuedTurn) => void = noop) =>
  renderHook(() => useMessageQueue({ sessionId: SESSION, agentId, onEdit }));

beforeEach(() => {
  useAppStore.setState({ agentQueue: {} });
});

describe('useMessageQueue', () => {
  it('enqueues turns in order, queued', () => {
    const { result } = render();
    act(() => {
      result.current.enqueue(makeTurn('t1'));
      result.current.enqueue(makeTurn('t2'));
    });
    expect(result.current.queue.map((q) => [q.id, q.status])).toEqual([
      ['t1', 'queued'],
      ['t2', 'queued'],
    ]);
  });

  it('captures the queued agent and routing override', () => {
    const override = { providerId: 'anthropic', model: 'claude-opus-5' } as const;
    const { result } = render();
    act(() => {
      result.current.enqueue({ ...makeTurn('t1'), override });
    });
    expect(useAppStore.getState().agentQueue[AGENT]?.[0]).toEqual(
      expect.objectContaining({ agentId: AGENT, override }),
    );
  });

  it('removes a queued turn by id', () => {
    const { result } = render();
    act(() => {
      result.current.enqueue(makeTurn('t1'));
      result.current.enqueue(makeTurn('t2'));
    });
    act(() => {
      result.current.removeQueued('t1');
    });
    expect(result.current.queue.map((q) => q.id)).toEqual(['t2']);
  });

  it('removes the item and hands it to onEdit on edit, override included', () => {
    const onEdit = vi.fn();
    const override = { providerId: 'cursor', model: 'composer-2.5' } as const;
    const { result } = render(AGENT, onEdit);
    act(() => {
      result.current.enqueue({ ...makeTurn('t1', 'edit me'), override });
    });
    act(() => {
      result.current.editQueued('t1');
    });
    expect(onEdit).toHaveBeenCalledWith(
      expect.objectContaining({ id: 't1', agentId: AGENT, content: 'edit me', override }),
    );
    expect(result.current.queue).toEqual([]);
  });

  it('ignores edit for an unknown id', () => {
    const onEdit = vi.fn();
    const { result } = render(AGENT, onEdit);
    act(() => {
      result.current.enqueue(makeTurn('t1'));
    });
    act(() => {
      result.current.editQueued('nope');
    });
    expect(onEdit).not.toHaveBeenCalled();
    expect(result.current.queue.map((q) => q.id)).toEqual(['t1']);
  });

  it('never drains on its own, the store does that when a turn ends', () => {
    const sendTurn = vi.fn();
    useAppStore.setState({ sendTurn });
    const { result } = render();
    act(() => {
      result.current.enqueue(makeTurn('t1'));
    });
    expect(sendTurn).not.toHaveBeenCalled();
  });

  it('keeps separate queues per agent', () => {
    const { result, rerender } = renderHook(
      ({ agentId }) => useMessageQueue({ sessionId: SESSION, agentId, onEdit: noop }),
      { initialProps: { agentId: AGENT } },
    );
    act(() => {
      result.current.enqueue(makeTurn('a'));
    });
    rerender({ agentId: OTHER_AGENT });
    expect(result.current.queue).toEqual([]);
    act(() => {
      result.current.enqueue(makeTurn('b', 'hi', OTHER_AGENT));
    });
    expect(result.current.queue.map((q) => q.id)).toEqual(['b']);
    rerender({ agentId: AGENT });
    expect(result.current.queue.map((q) => q.id)).toEqual(['a']);
  });
});
