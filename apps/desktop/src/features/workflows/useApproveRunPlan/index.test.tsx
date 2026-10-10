// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { SessionId, WorkflowRunId } from '@goodboy/types';
import { nextAgentId, nextWorkflowRunId } from '@goodboy/types/testing';
import { ToastProvider } from '../../../shared/components/Toast';
import { isUserStart } from '../../../shared/lib/userStarts';
import { sessionPlace } from '../../../store/slices/navigation/place';
import type { ApprovePlanResult } from '../../../store/slices/workflows/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../store/storyHarness';
import { seedSessionWithMounts } from '../../../__tests__/helpers/seedSessionWithMounts';
import { useApproveRunPlan } from '.';

let RUN_ID: WorkflowRunId = nextWorkflowRunId();
const IMPLEMENT_ID = nextAgentId();

let useAppStore: StoryStore;
let sessionId: SessionId;
let approveWorkflowRunPlan: Mock<() => Promise<ApprovePlanResult>>;
let reportError: Mock<() => Promise<void>>;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const ApproveButton = () => {
  const approve = useApproveRunPlan({ sessionId, runId: RUN_ID });
  return (
    <button type="button" onClick={() => void approve()}>
      Approve
    </button>
  );
};

const approve = async (): Promise<void> => {
  render(
    <ToastProvider>
      <ApproveButton />
    </ToastProvider>,
  );
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
  });
};

beforeEach(async () => {
  RUN_ID = nextWorkflowRunId();
  await resetStoryStore();
  stubStoryInvoke({ workspaces_with_unread: [] });
  sessionId = seedSessionWithMounts({ useAppStore });
  approveWorkflowRunPlan = vi.fn(async (): Promise<ApprovePlanResult> => ({
    kind: 'approved',
    next: 'continues',
    agentId: null,
  }));
  reportError = vi.fn(async () => undefined);
  useAppStore.setState({ approveWorkflowRunPlan, reportError });
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('approving the plan of a run', () => {
  it('raises one Plan approved toast with no action, because the run page is the one on screen', async () => {
    act(() =>
      useAppStore.getState().navigate({
        to: sessionPlace({ sessionId, lens: 'workflows', target: { kind: 'run', runId: RUN_ID } }),
      }),
    );

    await approve();

    expect(approveWorkflowRunPlan).toHaveBeenCalledWith(sessionId, RUN_ID);
    expect(await screen.findByText('Plan approved')).toBeDefined();
    expect(screen.getByText('The run goes on')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Follow the run' })).toBeNull();
    expect(screen.getAllByText('Plan approved')).toHaveLength(1);
  });

  it('marks the run as a start of yours, so the step bridge stays quiet', async () => {
    expect(isUserStart({ key: RUN_ID })).toBe(false);

    await approve();

    expect(isUserStart({ key: RUN_ID })).toBe(true);
  });

  it('names the step that started when approving starts it', async () => {
    useAppStore.setState({
      sessionPhaseRuns: {
        [sessionId]: [
          {
            id: IMPLEMENT_ID,
            sessionId,
            ordinal: 1,
            name: 'Implement',
            workflowRunId: RUN_ID,
            status: 'running',
          },
        ],
      },
    });
    approveWorkflowRunPlan.mockResolvedValueOnce({
      kind: 'approved',
      next: 'started',
      agentId: IMPLEMENT_ID,
    });

    await approve();

    expect(await screen.findByText('Implement started')).toBeDefined();
    expect(screen.getByText('Plan approved')).toBeDefined();
  });

  it('offers Follow the run when another page is on screen', async () => {
    act(() => useAppStore.getState().navigate({ to: sessionPlace({ sessionId }) }));

    await approve();

    expect(await screen.findByRole('button', { name: 'Follow the run' })).toBeDefined();
  });

  it('raises nothing when the approve was already done, or the run is gone', async () => {
    approveWorkflowRunPlan.mockResolvedValueOnce({ kind: 'noop', reason: 'not-held' });

    await approve();

    expect(approveWorkflowRunPlan).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Plan approved')).toBeNull();
    expect(reportError).not.toHaveBeenCalled();
    expect(isUserStart({ key: RUN_ID })).toBe(false);
  });

  it('reports a failed approve to the log, never as a toast', async () => {
    approveWorkflowRunPlan.mockResolvedValueOnce({
      kind: 'failed',
      message: 'The database is locked',
    });

    await approve();

    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't approve the plan", sessionId }),
    );
    expect(screen.queryByText('Plan approved')).toBeNull();
  });
});
