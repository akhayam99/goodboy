// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('../../../../../features/workspace-chat/activeChatBackend', async () => {
  const { createMemoryChatBackend } = await import('../../../../../test/createMemoryChatBackend');
  const { mockChatResponder } = await import('../../backends/chat/mockChatResponder');
  const { mockChatSeed } = await import('../../backends/chat/mockChatSeed');
  const { mockWorkSummarizer } = await import('../../backends/chat/mockWorkSummarizer');
  return {
    activeChatBackend: createMemoryChatBackend({
      respond: mockChatResponder,
      seed: mockChatSeed,
      summarize: mockWorkSummarizer,
    }),
  };
});

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U24_CHAT_IMAGE_SCENES } from './chat-image';

const BLOB_URL = 'blob:app://localhost/two-emails';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: () => BLOB_URL });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => undefined });
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
});

const settle = (): Promise<void> =>
  act(() => new Promise<void>((resolve) => window.setTimeout(resolve, 400)));

describe('the chat image bubble scene', () => {
  it('registers under its id', () => {
    expect(MOCK_SCENES['chat-image-bubble']).toBe(U24_CHAT_IMAGE_SCENES['chat-image-bubble']);
  });

  it('draws the attached image as a thumbnail with its name inside the sent bubble', async () => {
    const Scene = U24_CHAT_IMAGE_SCENES['chat-image-bubble'];
    render(
      <ToastProvider>
        <Scene />
      </ToastProvider>,
    );

    await screen.findByRole(
      'heading',
      { name: 'Why does notify-relay retry twice?' },
      { timeout: 4_000 },
    );
    await settle();

    const bubble = document.querySelector<HTMLElement>('[data-chat-message="user"]');
    const image = bubble?.querySelector('img');
    expect(image?.getAttribute('src')).toBe(BLOB_URL);
    expect(image?.getAttribute('alt')).toBe('two-emails.png');
    expect(bubble?.textContent).toContain('two-emails.png');
  });

  it('opens the viewer from the thumbnail and closes it with Escape', async () => {
    const Scene = U24_CHAT_IMAGE_SCENES['chat-image-bubble'];
    render(
      <ToastProvider>
        <Scene />
      </ToastProvider>,
    );
    await screen.findByRole(
      'heading',
      { name: 'Why does notify-relay retry twice?' },
      { timeout: 4_000 },
    );
    await settle();

    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    expect(screen.getByRole('dialog')).toBeDefined();

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    await settle();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
