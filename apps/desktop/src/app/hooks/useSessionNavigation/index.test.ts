import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session, SessionId, WorkspaceId } from '@goodboy/types';
import { sessionPlace } from '../../../store/slices/navigation/place';

const sessionOf = ({ id }: { readonly id: string }): Session => ({ id }) as Session;

const { navigate, store } = vi.hoisted(() => {
  const navigate = vi.fn();
  return {
    navigate,
    store: {
      sessions: [] as ReadonlyArray<{ id: string }>,
      groups: [] as ReadonlyArray<{ key: string; sessions: ReadonlyArray<{ id: string }> }>,
      currentSession: null as { id: string } | null,
      group: 'stage' as 'none' | 'stage',
      expanded: {} as Record<string, boolean>,
    },
  };
});

vi.mock('../../../store', async () => ({
  ...(await import('../../../store/slices/navigation/place')),
  useAppStore: (
    selector: (s: {
      navigate: typeof navigate;
      sessionGroupExpanded: Record<string, boolean>;
    }) => unknown,
  ) => selector({ navigate, sessionGroupExpanded: store.expanded }),
  useSessionViewPrefs: () => ({ group: store.group }),
  useCurrentWorkspace: () => ({ id: 'workspace-harborline' as WorkspaceId }),
  useCurrentSession: () => store.currentSession,
  useSessions: () => store.sessions,
  useSortedGroupedSessions: () => store.groups,
}));

import { useSessionNavigation } from './index';

const ids = ['s1', 's2', 's3'].map((id) => sessionOf({ id }));

describe('useSessionNavigation', () => {
  beforeEach(() => {
    navigate.mockClear();
    store.sessions = ids;
    store.groups = [
      { key: 'attention', sessions: [ids[2]!] },
      { key: 'running', sessions: [ids[0]!, ids[1]!] },
    ];
    store.currentSession = ids[2]!;
    store.group = 'stage';
    store.expanded = {};
  });

  it('steps through the sidebar order, not the store order', () => {
    const { result } = renderHook(() => useSessionNavigation());

    result.current({ delta: 1 });

    expect(navigate).toHaveBeenCalledWith({ to: sessionPlace({ sessionId: 's1' as SessionId }) });
  });

  it('crosses from one sidebar group to the previous one', () => {
    store.currentSession = ids[0]!;
    const { result } = renderHook(() => useSessionNavigation());

    result.current({ delta: -1 });

    expect(navigate).toHaveBeenCalledWith({ to: sessionPlace({ sessionId: 's3' as SessionId }) });
  });

  it('skips a session the sidebar hides', () => {
    store.groups = [{ key: 'none', sessions: [ids[0]!, ids[2]!] }];
    store.currentSession = ids[0]!;
    const { result } = renderHook(() => useSessionNavigation());

    result.current({ delta: 1 });

    expect(navigate).toHaveBeenCalledWith({ to: sessionPlace({ sessionId: 's3' as SessionId }) });
  });

  it('stays put at the end of the sidebar list', () => {
    store.currentSession = ids[1]!;
    const { result } = renderHook(() => useSessionNavigation());

    result.current({ delta: 1 });

    expect(navigate).not.toHaveBeenCalled();
  });

  it('opens the first or last visible session when none is open', () => {
    store.currentSession = null;
    const { result } = renderHook(() => useSessionNavigation());

    result.current({ delta: 1 });
    result.current({ delta: -1 });

    expect(navigate).toHaveBeenNthCalledWith(1, {
      to: sessionPlace({ sessionId: 's3' as SessionId }),
    });
    expect(navigate).toHaveBeenNthCalledWith(2, {
      to: sessionPlace({ sessionId: 's2' as SessionId }),
    });
  });

  it('skips a group the sidebar collapses by default', () => {
    store.groups = [
      { key: 'running', sessions: [ids[0]!] },
      { key: 'done', sessions: [ids[1]!] },
      { key: 'attention', sessions: [ids[2]!] },
    ];
    store.currentSession = ids[0]!;
    const { result } = renderHook(() => useSessionNavigation());

    result.current({ delta: 1 });

    expect(navigate).toHaveBeenCalledWith({ to: sessionPlace({ sessionId: 's3' as SessionId }) });
  });

  it('walks into a collapsed group once the sidebar expands it', () => {
    store.groups = [
      { key: 'running', sessions: [ids[0]!] },
      { key: 'done', sessions: [ids[1]!] },
    ];
    store.expanded = { done: true };
    store.currentSession = ids[0]!;
    const { result } = renderHook(() => useSessionNavigation());

    result.current({ delta: 1 });

    expect(navigate).toHaveBeenCalledWith({ to: sessionPlace({ sessionId: 's2' as SessionId }) });
  });

  it('walks every session when the sidebar is not grouped', () => {
    store.group = 'none';
    store.groups = [{ key: 'done', sessions: [ids[0]!, ids[1]!] }];
    store.currentSession = ids[0]!;
    const { result } = renderHook(() => useSessionNavigation());

    result.current({ delta: 1 });

    expect(navigate).toHaveBeenCalledWith({ to: sessionPlace({ sessionId: 's2' as SessionId }) });
  });

  it('jumps to the first visible session when the open one is hidden by the filter', () => {
    store.groups = [{ key: 'none', sessions: [ids[0]!, ids[1]!] }];
    store.currentSession = ids[2]!;
    const { result } = renderHook(() => useSessionNavigation());

    result.current({ delta: 1 });
    result.current({ delta: -1 });

    expect(navigate).toHaveBeenNthCalledWith(1, {
      to: sessionPlace({ sessionId: 's1' as SessionId }),
    });
    expect(navigate).toHaveBeenNthCalledWith(2, {
      to: sessionPlace({ sessionId: 's2' as SessionId }),
    });
  });
});
