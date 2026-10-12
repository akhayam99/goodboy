// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../store/storyHarness')).dbModuleMock(),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).dbLibModuleMock(),
);

type BackendHolder = { backend: ChatBackend | null };

const { holder } = vi.hoisted((): { holder: BackendHolder } => ({ holder: { backend: null } }));

vi.mock('../../../../../features/workspace-chat/activeChatBackend', () => ({
  activeChatBackend: new Proxy(
    {},
    {
      get: (_target, key) =>
        holder.backend === null ? undefined : Reflect.get(holder.backend, key),
    },
  ),
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { newChatBackend } from '../../../../../__tests__/helpers/chatListFixtures';
import type { ChatBackend } from '../../../../../features/workspace-chat/chatBackend';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { U25_TERMINAL_PAGE_SCENES } from './terminal-page';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  holder.backend = newChatBackend();
});

afterEach(cleanup);

const settle = (): Promise<void> =>
  act(() => new Promise<void>((resolve) => window.setTimeout(resolve, 150)));

describe('the chat first-run scene', () => {
  it('shows one Start a chat and no rail, then the rail once a chat is started', async () => {
    const Scene = U25_TERMINAL_PAGE_SCENES['chat-first-run'];
    render(
      <ToastProvider>
        <Scene />
      </ToastProvider>,
    );
    await settle();

    expect(screen.getByRole('heading', { name: 'No chats yet' })).toBeDefined();
    expect(screen.queryByRole('complementary', { name: 'Chat list' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'New chat' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Start a chat' }));
    await settle();

    expect(screen.getByRole('complementary', { name: 'Chat list' })).toBeDefined();
  });
});
