// @vitest-environment happy-dom

import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceId } from '@goodboy/types';

const h = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  calls: { thread: [] as ReadonlyArray<unknown>[], users: 0, channels: 0 },
}));

const buildState = () => ({
  ...h.state,
  refreshSlackThread: vi.fn(async (...args: ReadonlyArray<unknown>) => {
    h.calls.thread.push(args);
  }),
  refreshSlackUsers: vi.fn(async () => {
    h.calls.users += 1;
  }),
  refreshSlackChannels: vi.fn(async () => {
    h.calls.channels += 1;
  }),
});

vi.mock('../../../../store', () => {
  const useAppStore = <T>(selector: (state: Record<string, unknown>) => T): T =>
    selector(buildState());
  useAppStore.getState = () => buildState();
  return { EMPTY_ARRAY: Object.freeze([]), useAppStore };
});

const { useSlackThread } = await import('./index');

const WORKSPACE_ID = 'ws-1' as WorkspaceId;
const TARGET = {
  workspaceId: WORKSPACE_ID,
  channelId: 'C1',
  threadTs: '1723456789.123456',
  isEnabled: true,
};

beforeEach(() => {
  h.calls = { thread: [], users: 0, channels: 0 };
  h.state = {
    slackThreads: {
      'ws-1:C1:1723456789.123456': {
        messages: [{ ts: '1723456789.123456', text: 'billing webhook fails' }],
        fetchedAt: null,
        loading: false,
        error: null,
      },
    },
    slackUsers: {},
    slackChannels: {},
  };
});

describe('useSlackThread', () => {
  it('fetches the thread on mount and fills the missing user and channel caches', async () => {
    renderHook(() => useSlackThread(TARGET));

    await waitFor(() => {
      expect(h.calls.thread).toHaveLength(1);
    });
    expect(h.calls.thread[0]?.[0]).toEqual({
      workspaceId: WORKSPACE_ID,
      channelId: 'C1',
      threadTs: '1723456789.123456',
    });
    expect(h.calls.users).toBe(1);
    expect(h.calls.channels).toBe(1);
  });

  it('leaves an already cached directory alone', async () => {
    h.state.slackUsers = { [WORKSPACE_ID]: [] };
    h.state.slackChannels = {
      [WORKSPACE_ID]: {
        channels: [{ id: 'C1', name: 'eng-alerts', isMember: true, topic: null, memberCount: 2 }],
        loading: false,
        error: null,
      },
    };

    const { result } = renderHook(() => useSlackThread(TARGET));

    await waitFor(() => {
      expect(h.calls.thread).toHaveLength(1);
    });
    expect(h.calls.users).toBe(0);
    expect(h.calls.channels).toBe(0);
    expect(result.current.channelName).toBe('eng-alerts');
    expect(result.current.messages).toHaveLength(1);
  });

  it('stays quiet when the external id could not be read', async () => {
    renderHook(() => useSlackThread({ ...TARGET, isEnabled: false }));

    await waitFor(() => {
      expect(h.calls.channels).toBe(0);
    });
    expect(h.calls.thread).toEqual([]);
  });
});
