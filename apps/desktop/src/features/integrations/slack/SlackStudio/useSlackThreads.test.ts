// @vitest-environment happy-dom

import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionId, WorkspaceId } from '@goodboy/types';

const h = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  calls: { channels: 0, users: 0, heads: [] as string[] },
}));

const buildState = () => ({
  ...h.state,
  refreshSlackChannels: vi.fn(async () => {
    h.calls.channels += 1;
  }),
  refreshSlackUsers: vi.fn(async () => {
    h.calls.users += 1;
  }),
  refreshSlackThreadHeads: vi.fn(async ({ channelId }: { channelId: string }) => {
    h.calls.heads.push(channelId);
  }),
});

vi.mock('../../../../store', () => {
  const useAppStore = <T>(selector: (state: Record<string, unknown>) => T): T =>
    selector(buildState());
  useAppStore.getState = () => buildState();
  return {
    EMPTY_ARRAY: Object.freeze([]),
    useAppStore,
    useSessions: () => h.state.sessions ?? [],
  };
});

const { useSlackThreads } = await import('./useSlackThreads');

const WORKSPACE_ID = 'ws-1' as WorkspaceId;

const head = (ts: string, text: string, latestReplyAt: string) => ({
  ts,
  threadTs: ts,
  userId: 'U1',
  botId: null,
  text,
  subtype: null,
  replyCount: 2,
  replyUserCount: 2,
  postedAt: latestReplyAt,
  latestReplyAt,
  reactions: [],
});

beforeEach(() => {
  h.calls = { channels: 0, users: 0, heads: [] };
  h.state = {
    sessions: [],
    sessionExternalTasks: {},
    slackChannels: {
      [WORKSPACE_ID]: {
        channels: [
          { id: 'C1', name: 'eng-alerts', isMember: true, topic: null, memberCount: 3 },
          { id: 'C2', name: 'product', isMember: true, topic: null, memberCount: 9 },
        ],
        loading: false,
        error: null,
      },
    },
    slackUsers: { [WORKSPACE_ID]: [{ id: 'U1', name: 'ada', isBot: false, isDeleted: false }] },
    slackThreadHeads: {
      [`${WORKSPACE_ID}:C1`]: {
        heads: [head('1723456789.123456', 'billing webhook fails', '2026-08-05T09:00:00Z')],
        loading: false,
        error: null,
      },
      [`${WORKSPACE_ID}:C2`]: {
        heads: [head('1723400000.000100', 'roadmap review', '2026-08-04T09:00:00Z')],
        loading: false,
        error: null,
      },
    },
  };
});

describe('useSlackThreads', () => {
  it('fetches channels, users and every channel thread head on mount', async () => {
    renderHook(() => useSlackThreads({ workspaceId: WORKSPACE_ID, isEnabled: true }));

    await waitFor(() => {
      expect(h.calls.heads).toEqual(['C1', 'C2']);
    });
    expect(h.calls.channels).toBe(1);
    expect(h.calls.users).toBe(1);
  });

  it('does not touch slack when the workspace is not connected', async () => {
    renderHook(() => useSlackThreads({ workspaceId: WORKSPACE_ID, isEnabled: false }));

    await waitFor(() => {
      expect(h.calls.channels).toBe(0);
    });
    expect(h.calls.heads).toEqual([]);
  });

  it('groups threads by channel, newest channel first', () => {
    const { result } = renderHook(() =>
      useSlackThreads({ workspaceId: WORKSPACE_ID, isEnabled: true }),
    );

    expect(result.current.groups.map((group) => group.label)).toEqual(['#eng-alerts', '#product']);
    expect(result.current.groups[0]?.rows[0]?.head.text).toBe('billing webhook fails');
  });

  it('marks a thread that already has a session', () => {
    h.state.sessions = [{ id: 'session-1' as SessionId, workspaceId: WORKSPACE_ID }];
    h.state.sessionExternalTasks = {
      'session-1': [{ provider: 'slack', externalId: 'C1:1723456789.123456' }],
    };

    const { result } = renderHook(() =>
      useSlackThreads({ workspaceId: WORKSPACE_ID, isEnabled: true }),
    );

    expect(result.current.groups[0]?.rows[0]?.sessionId).toBe('session-1');
  });
});
