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
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { ObjectMenuProvider } from '../../../../../features/actions/components/ObjectMenuProvider';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { WORKSPACE_ID } from '../BoardScene';
import { U25_R4_CHATLIST_SCENES } from './r4-chatlist';

const FIND = { timeout: 6_000 };

const NAMES = ['r4-chatlist-states', 'r4-chatlist-selecting'] as const;

type SceneName = (typeof NAMES)[number];

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
});

const mount = async (name: SceneName): Promise<HTMLElement> => {
  const Scene = U25_R4_CHATLIST_SCENES[name];
  const { container } = render(
    <ToastProvider>
      <ObjectMenuProvider>
        <Scene />
      </ObjectMenuProvider>
    </ToastProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  expect(screen.queryByText('Something went wrong')).toBeNull();
  return container;
};

const chatList = async (): Promise<HTMLElement> =>
  screen.findByRole('navigation', { name: 'Chats' }, FIND);

const rowOf = (key: string): HTMLElement => {
  const row = document.querySelector(`[data-chat-row="mock-chat-${WORKSPACE_ID}-${key}"]`);
  if (!(row instanceof HTMLElement)) {
    throw new Error(`no chat row ${key}`);
  }
  return row;
};

const kindOf = (key: string): string | null =>
  rowOf(key).querySelector('[data-node-kind]')?.getAttribute('data-node-kind') ?? null;

describe('the r4 chat list scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(U25_R4_CHATLIST_SCENES)).toEqual([...NAMES]);
    for (const name of NAMES) {
      expect(MOCK_SCENES[name]).toBe(U25_R4_CHATLIST_SCENES[name]);
    }
  });

  it('r4-chatlist-states leads every row with its state node at rest', async () => {
    await mount('r4-chatlist-states');
    const list = await chatList();
    await waitFor(() => expect(kindOf('release')).toBe('answering'), FIND);

    expect(kindOf('changes')).toBe('unread');
    expect(kindOf('rounding')).toBe('unread');
    expect(kindOf('consent')).toBe('idle');
    expect(list.getAttribute('data-selecting')).toBe('false');
    expect(within(rowOf('release')).getByRole('img', { name: 'Answering' })).toBeDefined();
    expect(within(rowOf('changes')).getByRole('img', { name: 'New reply, unseen' })).toBeDefined();
  });

  it('r4-chatlist-selecting turns every node into the checkbox once two rows are picked', async () => {
    await mount('r4-chatlist-selecting');
    const list = await chatList();

    await waitFor(() => expect(list.getAttribute('data-selecting')).toBe('true'), FIND);
    expect(screen.getByText('2 selected')).toBeDefined();
    expect(within(rowOf('rounding')).getByRole('checkbox').getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(within(rowOf('consent')).getByRole('checkbox').getAttribute('aria-checked')).toBe(
      'false',
    );
  });

  it.each(NAMES)('%s passes the a11y check on the chat list', async (name) => {
    await mount(name);
    const list = await chatList();
    await waitFor(() => expect(kindOf('release')).toBe('answering'), FIND);

    const { violations } = await runA11yCheck(list);

    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
