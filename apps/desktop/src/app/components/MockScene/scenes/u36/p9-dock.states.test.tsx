// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { brandId, type AgentId, type IsoDateTime } from '@goodboy/types';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { aPlannerQuestion } from '../../../../../test/planDrawerFixtures';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { C06_AGENT_ID, C06_SESSION_ID } from '../u25/c06ConversationSeed';
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

const settle = async (): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
};

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
  await settle();
  const dock = document.querySelector<HTMLElement>('[data-conversation-dock]');
  if (dock === null) {
    throw new Error('no dock');
  }
  return dock;
};

describe('the dock while something runs', () => {
  it('holds the one Stop, no chat tail, and no send control on an empty box', async () => {
    const dock = await mount({ name: 'u36-p9-running' });

    within(dock).getByRole('button', { name: 'Stop' });
    expect(screen.getAllByRole('button', { name: 'Stop' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /^Queue/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Send now/ })).toBeNull();
  });

  it('presses that same Stop on Esc twice', async () => {
    const dock = await mount({ name: 'u36-p9-running' });
    const cancel = vi.fn(async () => undefined);
    act(() => useAppStore.setState({ cancelCurrentTurn: cancel }));
    const field = screen.getByRole('textbox');

    fireEvent.keyDown(field, { key: 'Escape', code: 'Escape' });
    within(dock).getByText('Esc again to stop');
    expect(cancel).not.toHaveBeenCalled();
    fireEvent.keyDown(field, { key: 'Escape', code: 'Escape' });

    expect(cancel).toHaveBeenCalledWith(C06_SESSION_ID, C06_AGENT_ID, 'user');
  });

  it('keeps the field where it is when you start to type', async () => {
    await mount({ name: 'u36-p9-running' });
    const toolbar = document.querySelector<HTMLElement>('[data-composer-toolbar]');
    const countBefore = document.querySelectorAll('[data-conversation-dock] ~ *').length;

    await act(async () => {
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'One more thing' } });
      await vi.advanceTimersByTimeAsync(50);
    });

    expect(document.querySelectorAll('[data-conversation-dock] ~ *')).toHaveLength(countBefore);
    expect(document.querySelector('[data-composer-toolbar]')).toBe(toolbar);
    expect(screen.queryByText(/Queue waits for this turn/)).toBeNull();
    screen.getByRole('button', { name: /^Queue/ });
  });
});

describe('the dock after a failure', () => {
  it('shows the reason and a filled Retry, the chat keeps one quiet line', async () => {
    const dock = await mount({ name: 'u36-p9-failed' });

    const retry = within(dock).getByRole('button', { name: 'Retry' });
    expect(retry.getAttribute('data-variant')).toBe('primary');
    expect(screen.getAllByRole('button', { name: 'Retry' })).toHaveLength(1);
    screen.getByRole('button', { name: 'Failed here' });
    expect(screen.getAllByText('Failed')).toHaveLength(1);
  });

  it('keeps the failure on screen when the retry fails too', async () => {
    const dock = await mount({ name: 'u36-p9-failed' });
    const sendTurn = vi.fn(async () => {
      throw new Error('The provider did not answer.');
    });
    const reportError = vi.fn(async () => undefined);
    act(() => useAppStore.setState({ sendTurn, reportError }));

    await act(async () => {
      fireEvent.click(within(dock).getByRole('button', { name: 'Retry' }));
      await vi.advanceTimersByTimeAsync(SETTLE_MS);
    });

    expect(sendTurn).toHaveBeenCalledOnce();
    expect(reportError).toHaveBeenCalledOnce();
    within(dock).getByRole('button', { name: 'Retry' });
  });
});

describe('the dock after a stop', () => {
  it('says who stopped it and offers one filled Continue', async () => {
    const dock = await mount({ name: 'u36-p9-stopped' });
    const continueStoppedAgent = vi.fn(async () => undefined);
    act(() => useAppStore.setState({ continueStoppedAgent }));

    within(dock).getByText('Stopped by you. What it wrote is kept.');
    await act(async () => {
      fireEvent.click(within(dock).getByRole('button', { name: 'Continue' }));
      await vi.advanceTimersByTimeAsync(SETTLE_MS);
    });

    expect(continueStoppedAgent).toHaveBeenCalledWith({
      sessionId: C06_SESSION_ID,
      agentId: C06_AGENT_ID,
    });
    expect(document.querySelector('[data-agent-stopped]')).toBeNull();
  });
});

describe('the dock when another agent waits on you', () => {
  it('offers the next item from the Overview cards, and Open reaches it', async () => {
    const dock = await mount({ name: 'u36-p9-running' });
    const asked = aPlannerQuestion({
      sessionId: C06_SESSION_ID,
      createdByAgentId: brandId<AgentId>({ value: 'mock-agent-tester' }),
    });
    act(() =>
      useAppStore.setState({
        sessionOpenQuestions: { [C06_SESSION_ID]: [asked] },
        loadSessionOpenQuestions: async () => undefined,
      }),
    );
    await settle();

    const row = dock.querySelector<HTMLElement>('[data-dock-next]');
    expect(row?.textContent).toMatch(/^Next:/);
    within(row ?? dock).getByRole('button', { name: 'Open' });
  });
});

describe('a Not delivered row over an open ask', () => {
  it('reads Send and deny, the words of the box', async () => {
    await mount({ name: 'u36-p9-permission' });
    const at = brandId<IsoDateTime>({ value: '2026-11-06T10:00:00.000Z' });
    act(() =>
      useAppStore.setState((state) => ({
        agentQueue: {
          ...state.agentQueue,
          [C06_AGENT_ID]: [
            {
              id: 'turn-held',
              agentId: C06_AGENT_ID,
              sessionId: C06_SESSION_ID,
              content: 'Use pnpm store prune',
              attachments: [],
              status: 'queued',
              createdAt: at,
              hold: { reason: 'Every provider is over its limit.' },
            },
          ],
        },
      })),
    );
    await settle();

    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    screen.getByRole('button', { name: 'Send and deny' });
  });
});

describe('the Auto dock', () => {
  it('names what Stop stops, and the limit, the failure and the project leave the chat', async () => {
    const running = await mount({ name: 'u36-p9-auto-running' });
    within(running).getByRole('button', { name: /^Stop Auto and \d agents?$/ });
    cleanup();

    const capped = await mount({ name: 'u36-p9-auto-limit' });
    within(capped).getByRole('button', { name: 'Raise to $20.00' });
    cleanup();

    const failed = await mount({ name: 'u36-p9-auto-failed' });
    within(failed).getByRole('button', { name: 'Retry' });
    cleanup();

    const project = await mount({ name: 'u36-p9-auto-project' });
    within(project).getByText(/^Where should the .* work\?$/);
  });

  it('moves the next step into the dock', async () => {
    const dock = await mount({ name: 'u36-p9-auto-next' });

    within(dock).getByRole('region', { name: 'Next step' });
    expect(screen.getAllByRole('region', { name: 'Next step' })).toHaveLength(1);
  });
});
