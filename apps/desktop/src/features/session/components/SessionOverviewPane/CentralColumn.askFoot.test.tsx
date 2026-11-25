// @vitest-environment happy-dom
vi.hoisted(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 18, 10, 31, 0));
});

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, within } from '@testing-library/react';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../test/fakeResizeObserver';
import { sceneInvoke, clearSceneInvoke } from '../../../../test/sceneInvoke';
import { resetWorktreeStatusCache } from '../../../../store/runtime/worktreeStatuses/cache';
import { AutoReleaseContext } from '../../../auto/autoReleaseContext';
import { ObjectMenuProvider } from '../../../actions/components/ObjectMenuProvider';
import {
  COLUMN_SESSION_ID,
  seedCentralColumn,
} from '../../../../app/components/MockScene/scenes/u26/centralColumnSeed';

let useAppStore: Awaited<ReturnType<typeof importStore>>;
let SessionOverviewPane: typeof import('.').SessionOverviewPane;

beforeAll(async () => {
  installFakeResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
  useAppStore = await importStore();
  ({ SessionOverviewPane } = await import('.'));
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  window.localStorage.clear();
  await resetStoryStore();
  resetWorktreeStatusCache();
  clearSceneInvoke();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
});

afterEach(cleanup);

afterAll(() => {
  vi.useRealTimers();
});

const show = async () => {
  const session = useAppStore
    .getState()
    .sessions.find((candidate) => candidate.id === COLUMN_SESSION_ID);
  if (session === undefined) {
    throw new Error('The seed must hold the session');
  }
  const view = render(
    <ToastProvider>
      <ObjectMenuProvider>
        <AutoReleaseContext.Provider value>
          <SessionOverviewPane session={session} />
        </AutoReleaseContext.Provider>
      </ObjectMenuProvider>
    </ToastProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  return view;
};

const askFoot = (): HTMLElement => {
  const foot = document.querySelector<HTMLElement>('[data-overview-ask]');
  if (foot === null) {
    throw new Error('The Ask foot is not shown');
  }
  return foot;
};

const spySend = () => {
  const sendAskQuestion = vi.fn(async () => true);
  useAppStore.setState({ sendAskQuestion });
  return sendAskQuestion;
};

describe('the Ask foot of the Overview', () => {
  it('sits under the Activity with the chips and one hint while the pane is closed', async () => {
    seedCentralColumn({ kind: 'branches' });
    await show();
    const foot = askFoot();
    const all = [...document.querySelectorAll('*')];
    const activity = document.querySelector('[data-overview-section="activity"]');
    if (activity === null) {
      throw new Error('The Activity is not shown');
    }

    expect(all.indexOf(foot)).toBeGreaterThan(all.indexOf(activity));
    within(foot).getByRole('group', { name: 'Try asking' });
    within(foot).getByPlaceholderText('Ask about this session');
  });

  it('hides while the pane is open and returns when it closes', async () => {
    seedCentralColumn({ kind: 'branches' });
    await show();
    act(() => useAppStore.getState().openAsk({ sessionId: COLUMN_SESSION_ID }));
    expect(document.querySelector('[data-overview-ask]')).toBeNull();

    act(() => useAppStore.getState().closeAsk({ sessionId: COLUMN_SESSION_ID }));
    askFoot();
  });

  it('opens the pane for its session and asks the chip there', async () => {
    seedCentralColumn({ kind: 'branches' });
    const sendAskQuestion = spySend();
    await show();
    const chip = within(askFoot()).getAllByRole('button')[0];
    if (chip === undefined) {
      throw new Error('no chip to try');
    }
    fireEvent.click(chip);

    expect(useAppStore.getState().askPaneOpen[COLUMN_SESSION_ID]).toBe(true);
    expect(sendAskQuestion).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: COLUMN_SESSION_ID, question: chip.textContent }),
    );
  });

  it('opens the pane for its session and asks the field there', async () => {
    seedCentralColumn({ kind: 'branches' });
    const sendAskQuestion = spySend();
    await show();
    const field = within(askFoot()).getByPlaceholderText('Ask about this session');
    fireEvent.change(field, { target: { value: 'What is left on notify-relay?' } });
    await act(async () => {
      fireEvent.click(within(askFoot()).getByRole('button', { name: 'Send' }));
    });

    expect(useAppStore.getState().askPaneOpen[COLUMN_SESSION_ID]).toBe(true);
    expect(sendAskQuestion).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: COLUMN_SESSION_ID,
        question: 'What is left on notify-relay?',
      }),
    );
  });

  it('is not shown on an archived session', async () => {
    seedCentralColumn({ kind: 'finished' });
    useAppStore.setState((state) => ({
      sessions: state.sessions.map((session) =>
        session.id === COLUMN_SESSION_ID ? { ...session, archivedAt: session.updatedAt } : session,
      ),
    }));
    await show();
    expect(document.querySelector('[data-overview-ask]')).toBeNull();
  });
});
