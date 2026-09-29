// @vitest-environment happy-dom

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { store } = vi.hoisted(() => ({
  store: {
    chatStreams: {} as Record<string, unknown>,
    unreadChatIds: [] as ReadonlyArray<string>,
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T>(selector: (state: typeof store) => T) => selector(store),
}));

import { useChatActivity } from './index';

describe('useChatActivity', () => {
  it('is quiet with no stream and no unread chat', () => {
    store.chatStreams = {};
    store.unreadChatIds = [];
    const { result } = renderHook(() => useChatActivity());
    expect(result.current).toEqual({ runningCount: 0, hasUnread: false });
  });

  it('counts every chat that is streaming', () => {
    store.chatStreams = { 'chat-1': {}, 'chat-2': {} };
    store.unreadChatIds = [];
    const { result } = renderHook(() => useChatActivity());
    expect(result.current.runningCount).toBe(2);
  });

  it('reports an unread reply', () => {
    store.chatStreams = {};
    store.unreadChatIds = ['chat-1'];
    const { result } = renderHook(() => useChatActivity());
    expect(result.current).toEqual({ runningCount: 0, hasUnread: true });
  });
});
