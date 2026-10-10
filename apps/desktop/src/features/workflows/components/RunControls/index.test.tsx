// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../store/storyHarness')).dbModuleMock({
    markAgentViewed: async () => undefined,
  }),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  ProviderRunId,
  SessionId,
  StepId,
  TurnState,
  WorkflowId,
  WorkflowOrchestrationStop,
  WorkflowRun,
  WorkflowRunId,
} from '@goodboy/types';
import { ToastProvider } from '../../../../shared/components/Toast';
import { isUserStart } from '../../../../shared/lib/userStarts';
import { sessionPlace } from '../../../../store/slices/navigation/place';
import type { ApprovePlanResult } from '../../../../store/slices/workflows/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { seedSessionWithMounts } from '../../../../__tests__/helpers/seedSessionWithMounts';
import { aPlan, aStoredPlan } from '../../../../test/planFixtures';
import { OrchestratorStrip } from '../OrchestratorStrip';
import { RunControls } from '.';

let RUN_ID = 'run-ledger-0' as WorkflowRunId;

let runCount = 0;
const WORKFLOW_ID = 'workflow-ledger' as WorkflowId;
const PLANNER_ID = 'agent-planner' as AgentId;
const IMPLEMENT_ID = 'agent-implement' as AgentId;

const HELD: WorkflowOrchestrationStop = { kind: 'plan-approval', message: 'The plan is ready.' };

let useAppStore: StoryStore;
let sessionId: SessionId;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const runOf = (overrides: Partial<WorkflowRun> = {}): WorkflowRun => ({
  id: RUN_ID,
  workflowId: WORKFLOW_ID,
  ordinal: 0,
  currentStep: 0,
  autoRun: false,
  triggerMode: 'immediate',
  executionMode: 'static',
  ...overrides,
});

const agentOf = (id: AgentId, ordinal: number, status: Agent['status'], name: string): Agent => ({
  id,
  sessionId,
  stepId: `step-${ordinal}` as StepId,
  workflowRunId: RUN_ID,
  ordinal,
  name,
  status,
});

const REVISING_TURN: TurnState = {
  kind: 'running',
  runId: 'run-revise' as ProviderRunId,
  startedAt: '2026-10-05T10:05:00.000Z' as IsoDateTime,
};

const PLAN_ID = 'plan-ledger' as ReturnType<typeof aPlan>['id'];

const seedRun = ({
  run,
  agents,
  hasPlan = true,
}: {
  readonly run: WorkflowRun;
  readonly agents: ReadonlyArray<Agent>;
  readonly hasPlan?: boolean;
}): void => {
  const state = useAppStore.getState();
  const plan = aPlan({ id: PLAN_ID, sessionId, agentId: PLANNER_ID, workflowRunId: RUN_ID });
  useAppStore.setState({
    sessions: state.sessions.map((session) =>
      session.id === sessionId ? { ...session, workflowRuns: [run] } : session,
    ),
    sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: agents },
    sessionPlans: { ...state.sessionPlans, [sessionId]: hasPlan ? [plan] : [] },
    sessionArtifacts: {
      ...state.sessionArtifacts,
      [sessionId]: hasPlan ? [aStoredPlan({ sessionId, agentId: PLANNER_ID }, plan)] : [],
    },
    focusedWorkflowRunId: { ...state.focusedWorkflowRunId, [sessionId]: RUN_ID },
  });
};

const onRunPage = (): void => {
  act(() =>
    useAppStore.getState().navigate({
      to: sessionPlace({ sessionId, lens: 'workflows', target: { kind: 'run', runId: RUN_ID } }),
    }),
  );
};

type Mocks = {
  readonly approveWorkflowRunPlan: Mock<() => Promise<ApprovePlanResult>>;
  readonly pauseWorkflowRun: Mock<() => Promise<void>>;
  readonly resumeWorkflowRun: Mock<() => Promise<void>>;
  readonly stopWorkflowRunNow: Mock<() => Promise<void>>;
  readonly reportError: Mock<() => Promise<void>>;
};

let onClose: Mock<() => void>;

let mocks: Mocks;

const installMocks = (): void => {
  mocks = {
    approveWorkflowRunPlan: vi.fn(async (): Promise<ApprovePlanResult> => ({
      kind: 'approved',
      next: 'continues',
      agentId: null,
    })),
    pauseWorkflowRun: vi.fn(async () => undefined),
    resumeWorkflowRun: vi.fn(async () => undefined),
    stopWorkflowRunNow: vi.fn(async () => undefined),
    reportError: vi.fn(async () => undefined),
  };
  onClose = vi.fn();
  useAppStore.setState({ ...mocks });
};

type HeaderParams = {
  readonly run: WorkflowRun;
  readonly agents: ReadonlyArray<Agent>;
  readonly isOrchestrating?: boolean;
  readonly isRunOver?: boolean;
  readonly withStrip?: boolean;
  readonly withMenu?: boolean;
  readonly canClose?: boolean;
};

const renderPage = ({
  run,
  agents,
  isOrchestrating = false,
  isRunOver = false,
  withStrip = false,
  withMenu = false,
  canClose = true,
}: HeaderParams) =>
  render(
    <ToastProvider>
      <div role="group" aria-label="Header">
        <RunControls
          sessionId={sessionId}
          run={run}
          agents={agents}
          isOrchestrating={isOrchestrating}
          isRunOver={isRunOver}
          onClose={canClose ? onClose : null}
          autonomyMenu={withMenu ? { label: 'Ledger run controls', onAutonomy: vi.fn() } : null}
        />
      </div>
      {withStrip ? (
        <OrchestratorStrip
          sessionId={sessionId}
          run={run}
          agents={agents}
          steps={[]}
          costUsd={0}
          isOrchestrating={isOrchestrating}
        />
      ) : null}
    </ToastProvider>,
  );

const header = () => screen.getByRole('group', { name: 'Header' });

const stopNames = (): ReadonlyArray<string> =>
  screen
    .queryAllByRole('button')
    .map((button) => button.getAttribute('aria-label') ?? button.textContent ?? '')
    .filter((name) => /^Stop\b/.test(name));

const live = (): ReadonlyArray<Agent> => [
  agentOf(PLANNER_ID, 0, 'completed', 'Plan'),
  agentOf(IMPLEMENT_ID, 1, 'running', 'Implement'),
];

const waiting = (): ReadonlyArray<Agent> => [
  agentOf(PLANNER_ID, 0, 'completed', 'Plan'),
  agentOf(IMPLEMENT_ID, 1, 'pending', 'Implement'),
];

beforeEach(async () => {
  runCount += 1;
  RUN_ID = `run-ledger-${runCount}` as WorkflowRunId;
  await resetStoryStore();
  stubStoryInvoke({ workspaces_with_unread: [] });
  sessionId = seedSessionWithMounts({ useAppStore });
  installMocks();
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('RunControls Stop buttons', () => {
  it('leaves exactly two Stop buttons on a live dynamic run, with distinct names', () => {
    const run = runOf({ executionMode: 'dynamic', autoRun: true });
    seedRun({ run, agents: live() });
    renderPage({ run, agents: live(), withStrip: true, isOrchestrating: false });

    expect(stopNames()).toEqual(['Stop run', 'Stop step']);
  });

  it('keeps Stop run in the header and Stop step in the strip, never the other way', () => {
    const run = runOf({ executionMode: 'dynamic', autoRun: true });
    seedRun({ run, agents: live() });
    renderPage({ run, agents: live(), withStrip: true });

    expect(within(header()).getByRole('button', { name: 'Stop run' })).toBeDefined();
    expect(within(header()).queryByRole('button', { name: 'Stop step' })).toBeNull();
    const strip = screen.getByTestId('orchestrator-strip');
    expect(within(strip).getByRole('button', { name: 'Stop step' })).toBeDefined();
    expect(within(strip).queryByRole('button', { name: 'Stop run' })).toBeNull();
    expect(within(strip).queryByRole('button', { name: 'Pause' })).toBeNull();
  });

  it('holds one Stop run on a static run, which has no strip of its own', () => {
    const run = runOf({ autoRun: true });
    seedRun({ run, agents: live() });
    renderPage({ run, agents: live() });

    expect(stopNames()).toEqual(['Stop run']);
  });

  it('keeps Pause and Stop run together as one pair', () => {
    const run = runOf({ autoRun: true });
    seedRun({ run, agents: live() });
    renderPage({ run, agents: live() });

    const pair = screen.getByRole('group', { name: 'Run controls' });
    expect(
      within(pair)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Pause', 'Stop run']);
    expect(pair.parentElement).toBe(header());
  });

  it('confirms Stop run before it ends the run, and says what it keeps', async () => {
    const run = runOf({ autoRun: true });
    seedRun({ run, agents: live() });
    renderPage({ run, agents: live() });

    fireEvent.click(screen.getByRole('button', { name: 'Stop run' }));
    const confirm = await screen.findByRole('group', { name: 'Stop this run?' });
    expect(confirm.textContent).toContain('Everything already written stays.');
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(within(confirm).getByRole('button', { name: 'Stop run' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mocks.stopWorkflowRunNow).not.toHaveBeenCalled();
  });

  it('offers Stop run on a run that waits between steps, with no Pause beside it', () => {
    const run = runOf();
    seedRun({ run, agents: waiting() });
    renderPage({ run, agents: waiting() });

    expect(stopNames()).toEqual(['Stop run']);
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
  });

  it('offers no Stop run on a run that cannot be stopped', () => {
    const run = runOf({ autoRun: true });
    seedRun({ run, agents: live() });
    renderPage({ run, agents: live(), canClose: false });

    expect(stopNames()).toEqual([]);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeDefined();
  });
});

describe('RunControls lifecycle', () => {
  it('pauses a live run and keeps Stop run on offer', () => {
    const run = runOf({ autoRun: true });
    seedRun({ run, agents: live() });
    renderPage({ run, agents: live() });

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));

    expect(mocks.pauseWorkflowRun).toHaveBeenCalledWith(sessionId, RUN_ID);
    expect(screen.getByRole('button', { name: 'Stop run' })).toBeDefined();
  });

  it('resumes a paused run from the header, with Stop run beside it', () => {
    const run = runOf({
      autoRun: true,
      orchestrationStop: { kind: 'paused', message: 'paused' },
    });
    seedRun({ run, agents: live() });
    renderPage({ run, agents: live() });

    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));

    expect(mocks.resumeWorkflowRun).toHaveBeenCalledWith(sessionId, RUN_ID);
    expect(screen.getByRole('button', { name: 'Stop run' })).toBeDefined();
  });

  it('offers no Pause while nothing runs, and no control once the run is over', () => {
    const run = runOf();
    seedRun({ run, agents: waiting() });
    const { unmount } = renderPage({ run, agents: waiting() });
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
    unmount();

    renderPage({ run, agents: live(), isRunOver: true });
    expect(header().querySelectorAll('button')).toHaveLength(0);
  });
  it('keeps Stop run but drops Pause once you stopped the run, and renders nothing when discarded', () => {
    const stopped = runOf({ orchestrationStop: { kind: 'operator', message: 'stopped' } });
    seedRun({ run: stopped, agents: live() });
    const first = renderPage({ run: stopped, agents: live() });
    expect(stopNames()).toEqual(['Stop run']);
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Resume' })).toBeNull();
    first.unmount();

    const discarded = runOf({ discardedAt: '2026-10-01T09:00:00.000Z' as IsoDateTime });
    renderPage({ run: discarded, agents: live() });
    expect(header().querySelectorAll('button')).toHaveLength(0);
  });
  it('opens when to ask from the overflow, next to nothing else on a run not held for its plan', () => {
    const run = runOf({ autoRun: true });
    seedRun({ run, agents: live() });
    renderPage({ run, agents: live(), withMenu: true });

    fireEvent.click(screen.getByRole('button', { name: 'Ledger run controls' }));

    expect(screen.queryByRole('menuitem', { name: 'Approve plan' })).toBeNull();
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(3);
  });
});

describe('RunControls while the run waits on its plan', () => {
  it('makes Review plan the header primary and Approve plan an item of the overflow', () => {
    const run = runOf({ orchestrationStop: HELD });
    seedRun({ run, agents: waiting() });
    renderPage({ run, agents: waiting(), withMenu: true });

    expect(within(header()).getByRole('button', { name: 'Review plan' })).toBeDefined();
    expect(within(header()).queryByRole('button', { name: 'Approve plan' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ledger run controls' }));

    expect(screen.getByRole('menuitem', { name: 'Approve plan' })).toBeDefined();
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(3);
  });

  it('opens the plan the run waits on in the drawer, over the page', () => {
    const run = runOf({ orchestrationStop: HELD });
    seedRun({ run, agents: waiting() });
    renderPage({ run, agents: waiting() });

    fireEvent.click(screen.getByRole('button', { name: 'Review plan' }));

    expect(useAppStore.getState().drawer).toMatchObject({
      kind: 'artifact-document',
      sessionId,
      payload: { artifactId: PLAN_ID },
    });
  });

  it('gives a dynamic run a ghost Approve plan beside Review plan, with no one-item overflow', () => {
    const run = runOf({ executionMode: 'dynamic', orchestrationStop: HELD });
    seedRun({ run, agents: waiting() });
    renderPage({ run, agents: waiting(), withStrip: true });

    expect(screen.getByRole('button', { name: 'Approve plan' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Plan actions' })).toBeNull();
    expect(
      within(screen.getByTestId('orchestrator-strip')).queryByRole('button', {
        name: 'Approve plan',
      }),
    ).toBeNull();
  });

  it('keeps Approve plan as the primary when there is no plan to review', () => {
    const run = runOf({ orchestrationStop: HELD });
    seedRun({ run, agents: waiting(), hasPlan: false });
    renderPage({ run, agents: waiting() });

    expect(within(header()).getByRole('button', { name: 'Approve plan' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Review plan' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Plan actions' })).toBeNull();
  });

  it('turns Approve plan off with the reason while the planner revises the plan', () => {
    const run = runOf({ orchestrationStop: HELD });
    seedRun({ run, agents: waiting() });
    useAppStore.setState({
      agentTurnState: { [PLANNER_ID]: REVISING_TURN },
    });
    renderPage({ run, agents: waiting() });

    const approve = screen.getByRole('button', { name: 'Approve plan' });

    expect(approve.hasAttribute('disabled')).toBe(true);
    fireEvent.click(approve);
    expect(mocks.approveWorkflowRunPlan).not.toHaveBeenCalled();
  });
});

describe('RunControls approve from the header', () => {
  const approveFromHeader = async (): Promise<void> => {
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Approve plan' }));
    });
  };

  const heldPage = (): void => {
    const run = runOf({ orchestrationStop: HELD });
    seedRun({ run, agents: waiting() });
    onRunPage();
    renderPage({ run, agents: waiting() });
  };

  it('raises one Plan approved toast with no action, because the run page is the one on screen', async () => {
    heldPage();

    await approveFromHeader();

    expect(mocks.approveWorkflowRunPlan).toHaveBeenCalledWith(sessionId, RUN_ID);
    expect(await screen.findByText('Plan approved')).toBeDefined();
    expect(screen.getByText('The run goes on')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Follow the run' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Follow' })).toBeNull();
    expect(screen.getAllByText('Plan approved')).toHaveLength(1);
  });

  it('marks the run as a start of yours, so the step bridge stays quiet', async () => {
    heldPage();
    expect(isUserStart({ key: RUN_ID })).toBe(false);

    await approveFromHeader();

    expect(isUserStart({ key: RUN_ID })).toBe(true);
  });

  it('names the step that started when approving starts it', async () => {
    mocks.approveWorkflowRunPlan.mockResolvedValueOnce({
      kind: 'approved',
      next: 'started',
      agentId: IMPLEMENT_ID,
    });
    heldPage();

    await approveFromHeader();

    expect(await screen.findByText('Implement started')).toBeDefined();
    expect(screen.getByText('Plan approved')).toBeDefined();
  });

  it('offers Follow the run when another page is on screen', async () => {
    const run = runOf({ orchestrationStop: HELD });
    seedRun({ run, agents: waiting() });
    act(() => useAppStore.getState().navigate({ to: sessionPlace({ sessionId }) }));
    renderPage({ run, agents: waiting() });

    await approveFromHeader();

    expect(await screen.findByRole('button', { name: 'Follow the run' })).toBeDefined();
  });

  it('raises nothing when the approve was already done, or the run is gone', async () => {
    mocks.approveWorkflowRunPlan.mockResolvedValueOnce({ kind: 'noop', reason: 'not-held' });
    heldPage();

    await approveFromHeader();

    expect(mocks.approveWorkflowRunPlan).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Plan approved')).toBeNull();
    expect(mocks.reportError).not.toHaveBeenCalled();
    expect(isUserStart({ key: RUN_ID })).toBe(false);
  });

  it('reports a failed approve to the log, never as a toast', async () => {
    mocks.approveWorkflowRunPlan.mockResolvedValueOnce({
      kind: 'failed',
      message: 'The database is locked',
    });
    heldPage();

    await approveFromHeader();

    expect(mocks.reportError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't approve the plan", sessionId }),
    );
    expect(screen.queryByText('Plan approved')).toBeNull();
  });
});
