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

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { useEscapeLayer } from '@goodboy/ui';
import { aSession } from '@goodboy/types/testing';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { aNowAgent, NOW_SESSION } from '../../../central/now/testing/nowModelOf';
import { startRunEventName } from '../../../startRun/startRunEventName';
import { sessionPlace } from '../../../../../store/slices/navigation/place';
import { PLACE_ROWS } from '../../../../../store/slices/navigation/placeRows';
import { WorkflowsPane } from './WorkflowsPane';

const session = aSession({ id: NOW_SESSION });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({ currentWorkspaceId: session.workspaceId, sessions: [session] });
});

afterEach(cleanup);

const seedRun = () => {
  useAppStore.setState({
    sessionPhaseRuns: {
      [NOW_SESSION]: [
        aNowAgent({ key: 'impl', name: 'Implement the retry cap', status: 'running' }),
      ],
    },
  });
};

const renderPane = () =>
  render(
    <ToastProvider>
      <WorkflowsPane session={session} />
    </ToastProvider>,
  );

const box = () => screen.queryByRole('textbox', { name: 'Start a run' });

const askToStart = (): void => {
  act(() => {
    window.dispatchEvent(
      new CustomEvent(startRunEventName({ sessionId: NOW_SESSION }), {
        detail: { text: 'Limit webhook retries' },
      }),
    );
  });
};

describe('WorkflowsPane', () => {
  it('is the form with no runs, and offers no Start a run row', () => {
    renderPane();

    expect(box()).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Start a run' })).toBeNull();
  });

  it('opens on the list with no Start a run row, since New in the head starts one', () => {
    seedRun();

    renderPane();

    screen.getByRole('list', { name: 'Runs' });
    expect(box()).toBeNull();
    expect(screen.queryByRole('button', { name: 'Start a run' })).toBeNull();
  });

  it('opens the form when something asks to start a run in this session, and Escape closes it', () => {
    seedRun();
    renderPane();

    askToStart();
    expect(box()).not.toBeNull();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(box()).toBeNull();
  });

  it('hands Escape to the layers below once a run page covers the open form', () => {
    seedRun();
    const onEscape = vi.fn();
    renderHook(() => useEscapeLayer(onEscape, true));
    renderPane();
    askToStart();

    act(() => {
      useAppStore.setState({ focusedWorkflowRunId: { [NOW_SESSION]: 'run-gone' } });
    });
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onEscape).toHaveBeenCalledOnce();
  });

  it('says Nothing is running with Clear filter on a place saved with Running and no runs', async () => {
    useAppStore.setState({ currentSessionId: NOW_SESSION });
    useAppStore
      .getState()
      .navigate({ to: sessionPlace({ sessionId: NOW_SESSION, lens: 'workflows' }) });
    useAppStore.getState().amendFocus({
      patch: { returnRows: { [PLACE_ROWS.runsFilter]: 'running' } },
    });
    renderPane();

    screen.getByText('Nothing is running');
    expect(box()).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filter' }));

    await waitFor(() => expect(box()).not.toBeNull());
    expect(screen.queryByText('Nothing is running')).toBeNull();
  });

  it('comes back to the list with the form shut after a run page', () => {
    seedRun();
    renderPane();
    askToStart();

    act(() => {
      useAppStore.setState({ focusedWorkflowRunId: { [NOW_SESSION]: 'run-gone' } });
    });
    act(() => {
      useAppStore.setState({ focusedWorkflowRunId: { [NOW_SESSION]: null } });
    });

    expect(box()).toBeNull();
    screen.getByRole('list', { name: 'Runs' });
  });
});
