// @vitest-environment happy-dom

import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';

const h = vi.hoisted(() => ({
  reply: vi.fn(async (_params: Record<string, unknown>) => undefined),
  react: vi.fn(async (_params: Record<string, unknown>) => undefined),
}));

vi.mock('../../../../store', () => {
  const state = {
    replyToSlackThread: (params: Record<string, unknown>) => h.reply(params),
    addSlackReaction: (params: Record<string, unknown>) => h.react(params),
  };
  return {
    EMPTY_ARRAY: Object.freeze([]),
    useAppStore: <T,>(selector: (value: typeof state) => T): T => selector(state),
  };
});

const { useSlackThreadActions } = await import('./index');

const WORKSPACE_ID = 'ws-1' as WorkspaceId;
const TARGET = {
  workspaceId: WORKSPACE_ID,
  channelId: 'C1',
  threadTs: '1723456789.123456',
  isEnabled: true,
};

beforeEach(() => {
  h.reply.mockReset();
  h.reply.mockResolvedValue(undefined);
  h.react.mockReset();
  h.react.mockResolvedValue(undefined);
});

describe('useSlackThreadActions', () => {
  it('sends the reply with the channel and thread it was mounted on', async () => {
    const { result } = renderHook(() => useSlackThreadActions(TARGET));

    await result.current.reply?.('on it');

    expect(h.reply).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      channelId: 'C1',
      threadTs: '1723456789.123456',
      text: 'on it',
    });
  });

  it('fires one write when two replies land in the same tick', async () => {
    let resolveWrite: () => void = () => undefined;
    h.reply.mockImplementation(
      async () =>
        new Promise<undefined>((resolve) => {
          resolveWrite = () => resolve(undefined);
        }),
    );
    const { result } = renderHook(() => useSlackThreadActions(TARGET));

    const first = result.current.reply?.('first');
    const second = result.current.reply?.('second');

    await expect(second).rejects.toThrow('Another Slack write is still running');
    resolveWrite();
    await first;
    expect(h.reply).toHaveBeenCalledTimes(1);
  });

  it('fires one reaction when two clicks land in the same tick', async () => {
    let resolveWrite: () => void = () => undefined;
    h.react.mockImplementation(
      async () =>
        new Promise<undefined>((resolve) => {
          resolveWrite = () => resolve(undefined);
        }),
    );
    const { result } = renderHook(() => useSlackThreadActions(TARGET));

    result.current.react?.({ messageTs: '1723456999.000100', name: 'eyes' });
    result.current.react?.({ messageTs: '1723456999.000100', name: 'tada' });

    expect(h.react).toHaveBeenCalledTimes(1);
    expect(h.react).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      channelId: 'C1',
      threadTs: '1723456789.123456',
      messageTs: '1723456999.000100',
      name: 'eyes',
    });
    resolveWrite();
    await waitFor(() => {
      expect(result.current.isWriting).toBe(false);
    });
  });

  it('surfaces a failed reaction instead of dropping it', async () => {
    h.react.mockRejectedValue(new Error('missing_scope: reactions:write'));
    const { result } = renderHook(() => useSlackThreadActions(TARGET));

    result.current.react?.({ messageTs: '1723456999.000100', name: 'eyes' });

    await waitFor(() => {
      expect(result.current.error).toContain('missing_scope: reactions:write');
    });
  });

  it('rethrows a failed reply so the composer can show it', async () => {
    h.reply.mockRejectedValue(new Error('channel_not_found'));
    const { result } = renderHook(() => useSlackThreadActions(TARGET));

    await expect(result.current.reply?.('on it')).rejects.toThrow('channel_not_found');
  });

  it('offers nothing to act with when the thread is not resolved', () => {
    const { result } = renderHook(() =>
      useSlackThreadActions({ ...TARGET, channelId: '', threadTs: '', isEnabled: false }),
    );

    expect(result.current.reply).toBeNull();
    expect(result.current.react).toBeNull();
  });
});
