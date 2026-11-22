// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UNDO_WINDOW_MS, useQueueSends } from './index';

type SendParams = {
  readonly id: string;
  readonly run: () => Promise<void>;
};

const queueAnswer = ({ id, run }: SendParams): void =>
  useQueueSends.getState().queue({
    send: { id, kind: 'answer', agentId: 'planner-harborline', moveId: `move-${id}` },
    run,
  });

beforeEach(() => {
  vi.useFakeTimers();
  useQueueSends.setState({ pending: {}, notNow: new Set(), drafts: {} });
});

afterEach(() => {
  useQueueSends.getState().flushAll();
  vi.useRealTimers();
});

describe('an answer or a message waits ten seconds before it goes out', () => {
  it('sends nothing inside the window and sends once when it closes', () => {
    const run = vi.fn(async () => undefined);
    queueAnswer({ id: 'answer-1', run });
    vi.advanceTimersByTime(UNDO_WINDOW_MS - 1);
    expect(run).not.toHaveBeenCalled();
    expect(useQueueSends.getState().pending['answer-1']?.moveId).toBe('move-answer-1');

    vi.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledTimes(1);
    expect(useQueueSends.getState().pending).toEqual({});
    expect(useQueueSends.getState().isWaiting({ id: 'answer-1' })).toBe(false);
  });

  it('Undo inside the window stops the send, and the agent never sees it', () => {
    const run = vi.fn(async () => undefined);
    queueAnswer({ id: 'answer-2', run });
    expect(useQueueSends.getState().cancel({ id: 'answer-2' })).toBe(true);
    vi.advanceTimersByTime(UNDO_WINDOW_MS * 2);
    expect(run).not.toHaveBeenCalled();
    expect(useQueueSends.getState().pending).toEqual({});
  });

  it('has no Undo once the answer went out', () => {
    const run = vi.fn(async () => undefined);
    queueAnswer({ id: 'answer-3', run });
    vi.advanceTimersByTime(UNDO_WINDOW_MS);
    expect(useQueueSends.getState().cancel({ id: 'answer-3' })).toBe(false);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('sends what is waiting at once when the window closes early', () => {
    const first = vi.fn(async () => undefined);
    const second = vi.fn(async () => undefined);
    queueAnswer({ id: 'answer-4', run: first });
    queueAnswer({ id: 'answer-5', run: second });
    useQueueSends.getState().flushAll();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(UNDO_WINDOW_MS);
    expect(first).toHaveBeenCalledTimes(1);
  });

  it('puts a Move off and brings it back once', () => {
    useQueueSends.getState().hide({ moveId: 'move-check' });
    expect(useQueueSends.getState().notNow.has('move-check')).toBe(true);
    expect(useQueueSends.getState().show({ moveId: 'move-check' })).toBe(true);
    expect(useQueueSends.getState().show({ moveId: 'move-check' })).toBe(false);
  });
});
