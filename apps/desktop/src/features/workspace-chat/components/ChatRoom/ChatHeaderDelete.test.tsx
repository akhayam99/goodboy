// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

const { holder } = vi.hoisted(() => ({ holder: { backend: null as ChatBackend | null } }));

vi.mock('../../activeChatBackend', () => ({
  activeChatBackend: new Proxy(
    {},
    {
      get: (_target, key) =>
        holder.backend === null ? undefined : Reflect.get(holder.backend, key),
    },
  ),
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  CHAT_WORKSPACE_ID,
  newChatBackend,
  seedChats,
} from '../../../../__tests__/helpers/chatListFixtures';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { ChatBackend } from '../../chatBackend';
import { ChatHeaderDelete } from './ChatHeaderDelete';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const open = async ({ isArchived = false }: { readonly isArchived?: boolean } = {}) => {
  holder.backend = newChatBackend();
  await seedChats({
    backend: holder.backend,
    seeds: [{ key: 'consent', title: 'Where is the consent step?', ageMs: 60_000, isArchived }],
  });
  const [chat] = await holder.backend.listChats({
    workspaceId: CHAT_WORKSPACE_ID,
    includeArchived: true,
  });
  await useAppStore.getState().loadChats({ workspaceId: CHAT_WORKSPACE_ID });
  if (chat === undefined) {
    throw new Error('the seeded chat is missing');
  }
  const onRemoved = vi.fn();
  render(
    <ToastProvider>
      <ChatHeaderDelete chat={chat} onRemoved={onRemoved} />
    </ToastProvider>,
  );
  return { onRemoved };
};

const remaining = async () =>
  holder.backend?.listChats({ workspaceId: CHAT_WORKSPACE_ID, includeArchived: true });

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('ChatHeaderDelete', () => {
  it('is on the header without a hover, and asks nothing until it is clicked', async () => {
    await open();

    expect(screen.getByRole('button', { name: 'Delete chat' })).toBeDefined();
    expect(screen.queryByText('Delete chat?')).toBeNull();
  });

  it('asks in place after one click, with Archive instead', async () => {
    await open();

    fireEvent.click(screen.getByRole('button', { name: 'Delete chat' }));

    expect(screen.getByText('Delete chat?')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Archive instead' })).toBeDefined();
    expect(screen.getByText('Where is the consent step?')).toBeDefined();
  });

  it('closes on Cancel and keeps the chat', async () => {
    const { onRemoved } = await open();
    fireEvent.click(screen.getByRole('button', { name: 'Delete chat' }));

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('Delete chat?')).toBeNull();
    expect(onRemoved).not.toHaveBeenCalled();
    expect(await remaining()).toHaveLength(1);
  });

  it('deletes the chat on the second click and leaves the room', async () => {
    const { onRemoved } = await open();
    fireEvent.click(screen.getByRole('button', { name: 'Delete chat' }));

    fireEvent.click(within(screen.getByRole('group')).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(onRemoved).toHaveBeenCalledTimes(1));
    expect(await remaining()).toHaveLength(0);
  });

  it('archives instead, says so with an Undo, and leaves the room', async () => {
    const { onRemoved } = await open();
    fireEvent.click(screen.getByRole('button', { name: 'Delete chat' }));

    fireEvent.click(screen.getByRole('button', { name: 'Archive instead' }));

    await waitFor(() => expect(onRemoved).toHaveBeenCalledTimes(1));
    expect((await remaining())?.[0]?.archivedAt).not.toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(async () => expect((await remaining())?.[0]?.archivedAt).toBeNull());
  });

  it('does not offer Archive instead on a chat that is already archived', async () => {
    await open({ isArchived: true });

    fireEvent.click(screen.getByRole('button', { name: 'Delete chat' }));

    expect(screen.queryByRole('button', { name: 'Archive instead' })).toBeNull();
  });
});
