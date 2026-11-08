// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ChatId, ChatSummary, IsoDateTime, WorkspaceId } from '@goodboy/types';
import { brandedId } from '../../../../history/testing/brandedId';
import { activeChatBackend, registerChatBackend } from '../../../activeChatBackend';
import { useWorkBriefDrafts, type WorkBriefDrafts } from '../../../hooks/useWorkBriefDrafts';
import { useWorkBrief } from './index';

const CHAT_ID = brandedId<ChatId>({ value: 'chat-consent' });
const AT = brandedId<IsoDateTime>({ value: '2026-09-28T10:00:00.000Z' });

const CHAT: ChatSummary = {
  id: CHAT_ID,
  workspaceId: brandedId<WorkspaceId>({ value: 'ws-harborline' }),
  title: 'Where is the consent step defined?',
  provider: 'anthropic',
  model: 'sonnet-5',
  effort: null,
  pinnedAt: null,
  archivedAt: null,
  lastActivityAt: AT,
  createdAt: AT,
  updatedAt: AT,
  preview: null,
  modelsUsed: [],
  messageCount: 2,
};

const DRAFTER = { provider: 'anthropic', model: 'sonnet-5' } as const;

const summarizeForWork = vi.fn(async (_params: unknown) =>
  JSON.stringify({ title: 'Ask again', goal: 'Generated goal', know: [], files: [], projects: [] }),
);

let room: ReturnType<typeof renderHook<WorkBriefDrafts, unknown>>;

const mount = () =>
  renderHook(() =>
    useWorkBrief({
      chat: CHAT,
      messages: [],
      anchorMessageId: null,
      drafter: DRAFTER,
      projectNames: ['payments-api'],
      drafts: room.result.current,
    }),
  );

beforeEach(() => {
  summarizeForWork.mockClear();
  registerChatBackend({ backend: { ...activeChatBackend, summarizeForWork } });
  room = renderHook(() => useWorkBriefDrafts({ chatId: CHAT_ID }));
});

afterEach(() => {
  cleanup();
});

describe('useWorkBrief', () => {
  it('keeps an edited goal across an unmount and a remount of the same chat', async () => {
    const first = mount();
    await waitFor(() => expect(first.result.current.brief?.goal).toBe('Generated goal'));
    act(() => first.result.current.patch({ next: { goal: 'My edited goal' } }));
    first.unmount();

    const second = mount();
    await waitFor(() => expect(second.result.current.brief?.goal).toBe('My edited goal'));
    expect(summarizeForWork).toHaveBeenCalledTimes(1);
  });

  it('drafts a fresh brief after the work was discarded', async () => {
    const first = mount();
    await waitFor(() => expect(first.result.current.brief?.goal).toBe('Generated goal'));
    act(() => first.result.current.patch({ next: { goal: 'My edited goal' } }));
    act(() => first.result.current.discard());
    first.unmount();

    const second = mount();
    await waitFor(() => expect(second.result.current.brief?.goal).toBe('Generated goal'));
    expect(summarizeForWork).toHaveBeenCalledTimes(2);
  });
});
