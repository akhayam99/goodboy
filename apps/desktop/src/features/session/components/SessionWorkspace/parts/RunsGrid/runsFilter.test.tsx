// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../../store/storyHarness')).dbModuleMock(),
);
vi.mock('../../../../../../shared/lib/db', async () =>
  (await import('../../../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Agent } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import { ToastProvider } from '../../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../../store/storyHarness';
import { aNowAgent, NOW_SESSION } from '../../../../central/now/testing/nowModelOf';
import { sessionRunsOf } from '../../../../sessionRunsOf';
import { currentStack } from '../../../../../../store/slices/navigation/currentStack';
import { sessionPlace } from '../../../../../../store/slices/navigation/place';
import { PLACE_ROWS } from '../../../../../../store/slices/navigation/placeRows';
import { RunsGrid } from './index';

const session = aSession({ id: NOW_SESSION });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  localStorage.clear();
  await resetStoryStore();
});

afterEach(cleanup);

type AgentsParams = {
  readonly agents: ReadonlyArray<Agent>;
};

const runsOf = ({ agents }: AgentsParams) =>
  sessionRunsOf({
    attachedRuns: [],
    agents,
    kindOverride: {},
    autoViews: [],
    orchestrating: {},
    questions: [],
    rootTurns: {},
    turnByAgentId: new Map(),
    revisingStarts: {},
    mounts: [],
    projects: [],
  });

const landOnRuns = ({ agents }: AgentsParams): void => {
  useAppStore.setState({
    currentWorkspaceId: session.workspaceId,
    currentSessionId: NOW_SESSION,
    sessions: [session],
    sessionPhaseRuns: { [NOW_SESSION]: agents },
  });
  useAppStore
    .getState()
    .navigate({ to: sessionPlace({ sessionId: NOW_SESSION, lens: 'workflows' }) });
  useAppStore.getState().amendFocus({
    patch: { returnRows: { [PLACE_ROWS.runsFilter]: 'running' } },
  });
};

const filterRow = (): string | undefined => {
  const stack = currentStack(useAppStore.getState());
  return stack.entries[stack.index]?.focus.returnRows?.[PLACE_ROWS.runsFilter];
};

const renderGrid = ({ agents }: AgentsParams) =>
  render(
    <ToastProvider>
      <RunsGrid session={session} runs={runsOf({ agents })} />
    </ToastProvider>,
  );

describe('Runs filtered to Running', () => {
  it('shows the Running chip and only running runs on a place saved with the filter', () => {
    const agents = [
      aNowAgent({ key: 'runner', name: 'Runner', status: 'running' }),
      aNowAgent({ key: 'done', name: 'Done', status: 'completed' }),
    ];
    landOnRuns({ agents });

    renderGrid({ agents });

    expect(document.querySelector('[data-runs-filter]')?.textContent).toContain('Running');
    screen.getByRole('button', { name: 'Open Runner, Agent, Running' });
    expect(screen.queryByRole('button', { name: /^Open Done,/ })).toBeNull();
    screen.getByRole('button', { name: 'Clear filter' });
  });

  it('clears the filter on the saved place and lists every run again', async () => {
    const agents = [
      aNowAgent({ key: 'runner', name: 'Runner', status: 'running' }),
      aNowAgent({ key: 'done', name: 'Done', status: 'completed' }),
    ];
    landOnRuns({ agents });
    renderGrid({ agents });

    fireEvent.click(screen.getByRole('button', { name: 'Clear filter' }));

    expect(filterRow()).toBeUndefined();
    await waitFor(() => expect(document.querySelector('[data-runs-filter]')).toBeNull());
    screen.getByRole('button', { name: /^Open Done,/ });
  });

  it('says Nothing is running with Clear filter when no run is running', async () => {
    const agents = [aNowAgent({ key: 'done', name: 'Done', status: 'completed' })];
    landOnRuns({ agents });
    renderGrid({ agents });

    screen.getByText('Nothing is running');
    expect(screen.queryByRole('button', { name: /^Open Done,/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filter' }));

    await waitFor(() => screen.getByRole('button', { name: /^Open Done,/ }));
    expect(screen.queryByText('Nothing is running')).toBeNull();
  });
});
