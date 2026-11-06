// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { AUTO_ROOT_ID, IMPLEMENTER_ID } from '../u24/autoSceneSeed';
import { C06_AGENT_ID } from '../u25/c06ConversationSeed';
import { U36_P9_DOCK_SCENES } from './p9-dock';

const SETTLE_MS = 2_000;

type SceneName = keyof typeof U36_P9_DOCK_SCENES;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  clearSceneInvoke();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const mount = async ({ name }: { readonly name: SceneName }): Promise<HTMLElement> => {
  const Scene = MOCK_SCENES[name];
  if (Scene === undefined) {
    throw new Error(`no scene ${name}`);
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  const dock = document.querySelector<HTMLElement>('[data-conversation-dock]');
  if (dock === null) {
    throw new Error('no dock');
  }
  return dock;
};

describe('the P9 dock scenes', () => {
  it('u36-p9-permission asks in the dock, and the chat holds no card', async () => {
    const dock = await mount({ name: 'u36-p9-permission' });

    within(dock).getByText(/wants to run a command/);
    within(dock).getByRole('button', { name: 'Allow and continue' });
    expect(screen.getAllByRole('button', { name: 'Allow and continue' })).toHaveLength(1);
    expect(document.querySelector('[data-glance]')?.textContent).toContain('Needs you');
    expect(document.querySelector('[data-glance]')?.textContent).not.toContain('wants to run');
  });

  it('u36-p9-permission-typed says the message denies, and Send and deny takes the fill', async () => {
    const dock = await mount({ name: 'u36-p9-permission-typed' });

    within(dock).getByText(/Your message will deny this/);
    const allow = within(dock).getByRole('button', { name: 'Allow and continue' });
    expect(allow.dataset.variant).toBe('quiet');
    expect(screen.getByRole('button', { name: 'Send and deny' }).dataset.variant).toBe('primary');
  });

  it('Send and deny goes to the agent that asks, through the one send path', async () => {
    await mount({ name: 'u36-p9-permission-typed' });
    const send = vi.fn(async () => ({ isDelivered: true, failure: null }));
    act(() => useAppStore.setState({ sendAgentMessage: send }));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send and deny' }));
      await vi.advanceTimersByTimeAsync(SETTLE_MS);
    });

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        turn: expect.objectContaining({
          agentId: C06_AGENT_ID,
          content: 'Use pnpm store prune, keep node_modules.',
        }),
      }),
    );
  });

  it('on Auto a message answers the agent whose ask the dock shows, never Auto', async () => {
    await mount({ name: 'u36-p9-auto-asks' });
    const send = vi.fn(async () => ({ isDelivered: true, failure: null }));
    act(() =>
      useAppStore.setState((state) => ({
        sendAgentMessage: send,
        agentDraft: { ...state.agentDraft, [AUTO_ROOT_ID]: 'Mock fetch by hand' },
      })),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SETTLE_MS);
    });
    screen.getByText(/Your message will deny this/);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send and deny' }));
      await vi.advanceTimersByTimeAsync(SETTLE_MS);
    });

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        turn: expect.objectContaining({ agentId: IMPLEMENTER_ID, override: undefined }),
      }),
    );
  });

  it('u36-p9-question asks in the dock with its pager', async () => {
    const dock = await mount({ name: 'u36-p9-question' });

    within(dock).getByText(/asks$/);
    within(dock).getByText('1 of 2');
    expect(screen.getAllByRole('heading', { name: /yarn\.lock/ })).toHaveLength(1);
  });

  it('u36-p9-auto-asks brings a subagent ask to Auto and names the agent, oldest first', async () => {
    const dock = await mount({ name: 'u36-p9-auto-asks' });

    within(dock).getByText('1 of 2');
    within(dock).getByText('pnpm add -D vitest-fetch-mock');
    within(dock).getByRole('button', { name: 'Open Implementer' });
    fireEvent.click(within(dock).getByRole('button', { name: 'Open Implementer' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SETTLE_MS);
    });
    expect(document.querySelector('[data-dock-ask="permission"]')).not.toBeNull();
  });
});
