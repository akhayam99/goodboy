import { act, cleanup, render, screen } from '@testing-library/react';
import { useContext } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { anAgent, nextProviderRunId, nextWorkspaceId, TEST_NOW } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  buildStoryWorkspace,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../store/storyHarness';
import { WorkTimeContext } from '../workTimeSource';
import { WorkTimeProvider } from './WorkTimeProvider';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('../../chat/turn', async () =>
  (await import('../../../store/storyHarness')).turnModuleMock(),
);

const workspace = buildStoryWorkspace({
  id: nextWorkspaceId(),
  name: 'Harborline',
  slug: 'harborline',
});
const agent = anAgent({ status: 'running' });
const RUN_ID = nextProviderRunId();

let useAppStore: StoryStore;

const QuietProbe = () => {
  const source = useContext(WorkTimeContext);
  return <span data-testid="quiet">{source?.quietMs?.get(agent.id) ?? 'none'}</span>;
};

const mountProvider = () =>
  render(
    <WorkTimeProvider sessionId={agent.sessionId} workspaceId={workspace.id}>
      <QuietProbe />
    </WorkTimeProvider>,
  );

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers();
  useAppStore.setState({
    sessionPhaseRuns: { [agent.sessionId]: [agent] },
    agentRunHistory: { [agent.id]: [RUN_ID] },
    agentTurnState: { [agent.id]: { kind: 'running', runId: RUN_ID, startedAt: TEST_NOW } },
    sessionTurnSpans: { [agent.sessionId]: [] },
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('WorkTimeProvider quiet runs', () => {
  it('hands the quiet time of a running turn to its agent', async () => {
    storySpies.listQuietRuns.mockResolvedValue([{ runId: RUN_ID, quietMs: 720_000 }]);

    mountProvider();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByTestId('quiet').textContent).toBe('720000');
  });

  it('asks again every 30 seconds and shows a turn that spoke again as not quiet', async () => {
    storySpies.listQuietRuns.mockResolvedValueOnce([{ runId: RUN_ID, quietMs: 720_000 }]);
    storySpies.listQuietRuns.mockResolvedValue([{ runId: RUN_ID, quietMs: 0 }]);

    mountProvider();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByTestId('quiet').textContent).toBe('720000');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(storySpies.listQuietRuns.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByTestId('quiet').textContent).toBe('0');
  });

  it('says nothing for a run the backend does not report', async () => {
    storySpies.listQuietRuns.mockResolvedValue([]);

    mountProvider();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByTestId('quiet').textContent).toBe('none');
  });
});
