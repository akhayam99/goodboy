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
import { act, cleanup, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U25_F58_CHAT_SCENES } from './f58-chat';

const FIND = { timeout: 6_000 };

const NAMES = ['f58-chat-room', 'f58-chat-1100', 'f58-chat-origin'] as const;

type SceneName = (typeof NAMES)[number];

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
});

type MountParams = {
  readonly name: SceneName;
};

const mount = async ({ name }: MountParams): Promise<void> => {
  const Scene = U25_F58_CHAT_SCENES[name];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  expect(screen.queryByText('Something went wrong')).toBeNull();
};

describe('the f58 chat scenes', () => {
  it('registers every scene', () => {
    expect(Object.keys(U25_F58_CHAT_SCENES)).toEqual([...NAMES]);
    NAMES.forEach((name) => expect(MOCK_SCENES[name]).toBeDefined());
  });

  it.each(['f58-chat-room', 'f58-chat-1100'] as const)(
    '%s shows the started session under its answer and the hidden provider marks',
    async (name) => {
      await mount({ name });

      expect(
        await screen.findByRole(
          'button',
          { name: 'Started Ask for consent again when the policy changes' },
          FIND,
        ),
      ).toBeDefined();
      expect(document.querySelector('[data-limits-overflow-marks]')).not.toBeNull();
    },
  );

  it('f58-chat-origin opens the session that names its chat', async () => {
    await mount({ name: 'f58-chat-origin' });

    expect(await screen.findByText(/From chat/, undefined, FIND)).toBeDefined();
  });
});
