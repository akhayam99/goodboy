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

const { holder } = vi.hoisted<{ holder: { backend: ChatBackend | null } }>(() => ({
  holder: { backend: null },
}));

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
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { aProject, aWorkspace } from '@goodboy/types/testing';
import type { ChatMessage } from '@goodboy/types';
import type { PendingAttachment } from '../../../attachments/pendingAttachment';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { ChatBackend } from '../../chatBackend';
import { createMemoryChatBackend } from '../../createMemoryChatBackend';
import { ChatImageTile } from './ChatImageTile';
import { ChatUserMessage } from './ChatUserMessage';

const BLOB_URL = 'blob:app://localhost/retry-trace';
const HARBORLINE = aWorkspace({ name: 'Harborline' });
const PAYMENTS = aProject({
  workspaceId: HARBORLINE.id,
  name: 'payments-api',
  rootPath: '/Users/mara/code/harborline/payments-api',
});

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const newBackend = (): ChatBackend =>
  createMemoryChatBackend({ respond: async () => ({ status: 'done' }) });

const screenshot: PendingAttachment = {
  id: 'att-1',
  fileName: 'retry-trace.png',
  mimeType: 'image/png',
  blob: new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }),
  relPath: null,
};

const askWithImage = async (): Promise<ChatMessage> => {
  useAppStore.setState({ projects: [PAYMENTS], workspaces: [HARBORLINE] });
  const slice = useAppStore.getState();
  await slice.loadChats({ workspaceId: HARBORLINE.id });
  const chatId = await slice.createChat({
    workspaceId: HARBORLINE.id,
    provider: 'anthropic',
    model: 'sonnet-5',
  });
  await slice.sendChatMessage({
    chatId,
    content: 'Why does notify-relay retry twice?',
    attachments: [screenshot],
  });
  const [asked] = useAppStore.getState().chatMessages[chatId] ?? [];
  if (asked === undefined) {
    throw new Error('the question was not stored');
  }
  return asked;
};

beforeEach(async () => {
  await resetStoryStore();
  holder.backend = newBackend();
  vi.spyOn(URL, 'createObjectURL').mockReturnValue(BLOB_URL);
  vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('a chat message with an image', () => {
  it('shows the thumbnail inside the user bubble with its name under it', async () => {
    const asked = await askWithImage();
    const { container } = render(<ChatUserMessage message={asked} />);
    const bubble = container.querySelector('[data-chat-message="user"]');
    await waitFor(() => expect(bubble?.querySelector('img')?.getAttribute('src')).toBe(BLOB_URL));
    expect(bubble?.querySelector('figcaption')?.textContent).toBe('retry-trace.png');
  });

  it('opens the viewer on click and closes it on Escape', async () => {
    const asked = await askWithImage();
    const [attachment] = asked.attachments;
    if (attachment === undefined) {
      throw new Error('the image was not stored');
    }
    render(<ChatImageTile attachment={attachment} />);
    await screen.findByAltText('retry-trace.png');
    expect(screen.getAllByAltText('retry-trace.png')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    await waitFor(() => expect(screen.getAllByAltText('retry-trace.png')).toHaveLength(2));
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.getAllByAltText('retry-trace.png')).toHaveLength(1));
  });

  it('shows the missing icon and no preview button when the file is gone', async () => {
    const asked = await askWithImage();
    const [attachment] = asked.attachments;
    if (attachment === undefined) {
      throw new Error('the image was not stored');
    }
    holder.backend = newBackend();
    render(<ChatImageTile attachment={attachment} />);
    await screen.findByLabelText('Image no longer on this computer');
    expect(screen.queryByRole('button', { name: 'Preview' })).toBeNull();
  });
});
