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
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Agent, WorkflowRun } from '@goodboy/types';
import { TEST_NOW } from '@goodboy/types/testing';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { captureLocation } from '../../../../../store/slices/navigation/captureLocation';
import { locationKey } from '../../../../../store/slices/navigation/locationKey';
import { sessionPlace } from '../../../../../store/slices/navigation/place';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { PLAN_FIXTURE_ID, aPlan, aStoredPlan } from '../../../../../test/planFixtures';
import {
  AGENT,
  RUN,
  SESSION,
  STEP_BUILD,
  STEP_PLAN,
  mountFixture,
  questionFixture,
  runFixture,
  seedActionState,
  sessionFixture,
  stepAgent,
  workflowFixture,
} from '../../../../../__tests__/helpers/actionFixtures';
import { STEP_ROUTING_REQUEST_EVENT } from '../../../../workflows/requestStepRouting';
import { useRunView } from '../useRunView';
import { RunHeader } from '.';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const PLAN_ID = PLAN_FIXTURE_ID;
const HELD = { kind: 'plan-approval', message: 'The plan is ready.' } as const;

const actionStubs = {
  pauseWorkflowRun: vi.fn(async () => undefined),
  resumeWorkflowRun: vi.fn(async () => undefined),
  retryWorkflowOrchestration: vi.fn(async () => undefined),
  orchestrateNextStep: vi.fn(async () => undefined),
  closeWorkflowRun: vi.fn(async () => undefined),
  restoreWorkflow: vi.fn(async () => undefined),
  startWorkflowRun: vi.fn(async () => undefined),
  activateWorkflowAgent: vi.fn(async () => undefined),
  renameWorkflowRun: vi.fn(async () => undefined),
  setWorkflowRunAutonomy: vi.fn(async () => undefined),
  setWorkflowRunSpendLimit: vi.fn(async () => undefined),
  discardWorkflow: vi.fn(async () => undefined),
  reportError: vi.fn(async () => undefined),
};

type Setup = {
  readonly run?: Partial<WorkflowRun>;
  readonly agents?: ReadonlyArray<Agent>;
  readonly hasPlan?: boolean;
  readonly hasMount?: boolean;
  readonly questions?: ReturnType<typeof questionFixture>[];
};

const seed = ({
  run = {},
  agents = [],
  hasPlan = false,
  hasMount = true,
  questions = [],
}: Setup): void => {
  seedActionState({
    useAppStore,
    seed: {
      session: sessionFixture({ workflowRuns: [runFixture(run)] }),
      workflows: [workflowFixture()],
      agents,
      questions,
      mounts: hasMount ? [mountFixture()] : [],
    },
  });
  const plan = aPlan({ id: PLAN_ID, sessionId: SESSION, agentId: AGENT, workflowRunId: RUN });
  useAppStore.setState({
    sessionPlans: { [SESSION]: hasPlan ? [plan] : [] },
    sessionArtifacts: {
      [SESSION]: hasPlan ? [aStoredPlan({ sessionId: SESSION, agentId: AGENT }, plan)] : [],
    },
    ...actionStubs,
  });
};

const Page = () => {
  const session = useAppStore((state) =>
    state.sessions.find((candidate) => candidate.id === SESSION),
  );
  const workflow = useAppStore((state) => state.sessionWorkflows[SESSION]?.[0]);
  const run = session?.workflowRuns.find((candidate) => candidate.id === RUN);
  if (session === undefined || workflow === undefined || run === undefined) {
    return null;
  }
  return <Header session={session} run={run} workflow={workflow} />;
};

type HeaderProps = Parameters<typeof useRunView>[0];

const Header = ({ session, run, workflow }: HeaderProps) => {
  const view = useRunView({ session, run, workflow });
  return <RunHeader session={session} view={view} />;
};

const renderHeader = () =>
  render(
    <ToastProvider>
      <Page />
    </ToastProvider>,
  );

const primaries = (): ReadonlyArray<string> =>
  Array.from(document.querySelectorAll('button[data-variant="primary"]')).map(
    (button) => button.textContent ?? '',
  );

const overflowItems = (): ReadonlyArray<string> => {
  fireEvent.click(screen.getByRole('button', { name: /run actions$/ }));
  return screen.getAllByRole('menuitem').map((item) => item.textContent ?? '');
};

const LIVE: ReadonlyArray<Agent> = [
  stepAgent({ id: 'agent-plan', stepId: STEP_PLAN, status: 'completed' }),
  stepAgent({ id: 'agent-build', stepId: STEP_BUILD, status: 'running' }),
];

const WAITING: ReadonlyArray<Agent> = [
  stepAgent({ id: 'agent-plan', stepId: STEP_PLAN, status: 'completed' }),
  stepAgent({ id: 'agent-build', stepId: STEP_BUILD, status: 'pending' }),
];

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ workspaces_with_unread: [] });
  Object.values(actionStubs).forEach((stub) => stub.mockClear());
});

afterEach(() => {
  cleanup();
});

describe('the run header title', () => {
  it('draws one h1 with the run name and no chevron to the other runs', () => {
    seed({ run: { executionMode: 'dynamic', title: 'Duplicate credit fix' }, agents: LIVE });
    renderHeader();

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Duplicate credit fix' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Show run summary' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Expand / })).toBeNull();
  });

  it('renames only this run from the title', () => {
    seed({ run: { executionMode: 'dynamic', title: 'Duplicate credit fix' }, agents: LIVE });
    renderHeader();

    fireEvent.click(screen.getByRole('button', { name: 'Edit run name' }));
    const input = screen.getByRole('textbox', { name: 'Run name' });
    fireEvent.change(input, { target: { value: 'Credit retry fix' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(actionStubs.renameWorkflowRun).toHaveBeenCalledWith(SESSION, RUN, 'Credit retry fix');
  });

  it('falls back to the workflow name for a run with no title, and renames only the run', () => {
    seed({ run: { executionMode: 'dynamic' }, agents: LIVE });
    renderHeader();

    expect(screen.getByRole('heading', { level: 1, name: 'Settlement export' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Edit run name' }));
    expect(screen.getByRole('textbox', { name: 'Run name' })).toHaveProperty(
      'value',
      'Settlement export',
    );
  });

  it('offers no Make preset anywhere in the header or its menu', () => {
    seed({ run: { executionMode: 'dynamic' }, agents: LIVE });
    renderHeader();

    expect(screen.queryByRole('button', { name: 'Make preset' })).toBeNull();
    expect(overflowItems()).not.toContain('Make preset');
  });

  it('offers no Start another run in the run header', () => {
    seed({ run: { executionMode: 'dynamic' }, agents: LIVE });
    renderHeader();

    expect(screen.queryByRole('button', { name: 'Start another run' })).toBeNull();
  });
});

describe('the run header primary', () => {
  it('makes Review plan the one entry for a plan the run waits on, and opens the drawer', () => {
    seed({ run: { orchestrationStop: HELD }, agents: WAITING, hasPlan: true });
    renderHeader();

    expect(primaries()).toEqual(['Review plan']);
    expect(screen.queryByRole('button', { name: 'Approve plan' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Review plan' }));

    expect(useAppStore.getState().drawer).toMatchObject({
      kind: 'artifact-document',
      sessionId: SESSION,
      payload: { artifactId: PLAN_ID },
    });
  });

  it('keeps Approve plan out of the overflow, because the drawer finishes Review plan', () => {
    seed({ run: { orchestrationStop: HELD }, agents: WAITING, hasPlan: true });
    renderHeader();

    expect(overflowItems()).not.toContain('Approve plan');
  });

  it('keeps Approve plan as the one entry when there is no plan to read', () => {
    seed({ run: { orchestrationStop: HELD }, agents: WAITING, hasPlan: false });
    renderHeader();

    expect(primaries()).toEqual(['Approve plan']);
    expect(screen.queryByRole('button', { name: 'Review plan' })).toBeNull();
  });

  it('resumes a paused run and keeps Stop run beside it', () => {
    seed({
      run: { executionMode: 'dynamic', orchestrationStop: { kind: 'paused', message: 'paused' } },
      agents: LIVE,
    });
    renderHeader();

    expect(primaries()).toEqual(['Resume']);
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));

    expect(actionStubs.resumeWorkflowRun).toHaveBeenCalledWith(SESSION, RUN);
    expect(screen.getByRole('button', { name: 'Stop run' })).toBeDefined();
  });

  it('reports a failed resume and leaves the button ready for another try', async () => {
    seed({
      run: { executionMode: 'dynamic', orchestrationStop: { kind: 'paused', message: 'paused' } },
      agents: LIVE,
    });
    actionStubs.resumeWorkflowRun.mockRejectedValueOnce(new Error('The database is locked'));
    renderHeader();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    });

    expect(actionStubs.reportError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't resume the run", sessionId: SESSION }),
    );
    expect(screen.getByRole('button', { name: 'Resume' }).hasAttribute('disabled')).toBe(false);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    });
    expect(actionStubs.resumeWorkflowRun).toHaveBeenCalledTimes(2);
  });

  it('asks for the first step on a dynamic run that has not started', () => {
    seed({ run: { executionMode: 'dynamic' }, agents: [] });
    renderHeader();

    expect(primaries()).toEqual(['Decide next step']);
    fireEvent.click(screen.getByRole('button', { name: 'Decide next step' }));

    expect(actionStubs.orchestrateNextStep).toHaveBeenCalledWith(SESSION, RUN);
  });

  it('offers no step to decide while the run goes on by itself', () => {
    seed({ run: { executionMode: 'dynamic', autoRun: true }, agents: WAITING });
    renderHeader();

    expect(primaries()).toEqual([]);
  });

  it('continues a run you stopped', () => {
    seed({
      run: {
        executionMode: 'dynamic',
        orchestrationStop: { kind: 'operator', message: 'You stopped this run.' },
      },
      agents: [stepAgent({ id: 'agent-plan', stepId: STEP_PLAN, status: 'skipped' })],
    });
    renderHeader();

    expect(primaries()).toEqual(['Continue the run']);
    fireEvent.click(screen.getByRole('button', { name: 'Continue the run' }));

    expect(actionStubs.retryWorkflowOrchestration).toHaveBeenCalledWith(SESSION, RUN);
  });

  it('retries a failed decision', () => {
    seed({
      run: {
        executionMode: 'dynamic',
        orchestrationStop: { kind: 'failure', message: 'usage limit' },
      },
      agents: [stepAgent({ id: 'agent-plan', stepId: STEP_PLAN, status: 'completed' })],
    });
    renderHeader();

    expect(primaries()).toEqual(['Retry']);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(actionStubs.retryWorkflowOrchestration).toHaveBeenCalledWith(SESSION, RUN);
  });

  it('raises the run spend cap from a budget pause, saving it for this run', () => {
    seed({
      run: {
        executionMode: 'dynamic',
        orchestrationStop: { kind: 'budget', message: 'Paused at the $12.00 spend cap.' },
      },
      agents: [stepAgent({ id: 'agent-plan', stepId: STEP_PLAN, status: 'completed' })],
    });
    renderHeader();

    expect(primaries()).toEqual(['Raise spend cap']);
    fireEvent.click(screen.getByRole('button', { name: 'Raise spend cap' }));
    fireEvent.change(screen.getByTestId('spend-limit-amount'), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('tab', { name: /Warn only/ }));
    fireEvent.click(screen.getByTestId('run-spend-limit-save'));

    expect(actionStubs.setWorkflowRunSpendLimit).toHaveBeenCalledWith(SESSION, RUN, 8, 'notify');
  });

  it('sends a session cap pause to the session cap editor, not to the run cap', () => {
    seed({
      run: {
        executionMode: 'dynamic',
        orchestrationStop: { kind: 'budget', message: 'cap reached' },
      },
      agents: [stepAgent({ id: 'agent-plan', stepId: STEP_PLAN, status: 'completed' })],
    });
    useAppStore.setState({
      budgetAlerts: [
        {
          id: 'alert-session',
          kind: 'session-exceeded',
          sessionId: SESSION,
          currentUsd: 12,
          capUsd: 10,
          createdAt: TEST_NOW,
        },
      ],
    });
    renderHeader();
    const opened = vi.fn();
    window.addEventListener('goodboy:edit-session-spend-limit', opened);

    fireEvent.click(screen.getByRole('button', { name: 'Raise spend cap' }));
    window.removeEventListener('goodboy:edit-session-spend-limit', opened);

    expect(opened).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: 'Spend cap for this run' })).toBeNull();
  });

  it('answers the question a run waits on, opening the questions', () => {
    seed({
      run: { executionMode: 'dynamic' },
      agents: [stepAgent({ id: 'agent-plan', stepId: STEP_PLAN, status: 'completed' })],
      questions: [questionFixture({ workflowRunId: RUN })],
    });
    renderHeader();

    expect(primaries()).toEqual(['Answer']);
    fireEvent.click(screen.getByRole('button', { name: 'Answer' }));

    expect(locationKey({ place: captureLocation({ state: useAppStore.getState() }).place })).toBe(
      locationKey({ place: sessionPlace({ sessionId: SESSION, lens: 'questions' }) }),
    );
  });

  it('starts a queued manual run, and names the Start run primary once', () => {
    seed({ run: { triggerMode: 'manual' }, agents: [] });
    renderHeader();

    expect(primaries()).toEqual(['Start run']);
    fireEvent.click(screen.getByRole('button', { name: 'Start run' }));

    expect(actionStubs.startWorkflowRun).toHaveBeenCalledWith(SESSION, RUN);
  });

  it('names the blocker and starts a queued run only after an explicit override', async () => {
    seed({
      run: { triggerMode: 'manual' },
      agents: [],
      questions: [questionFixture({ workflowRunId: RUN })],
    });
    renderHeader();

    fireEvent.click(screen.getByRole('button', { name: 'Start run' }));
    const confirm = screen.getByRole('group', { name: 'Start this run anyway?' });
    expect(confirm.textContent).toMatch(/open questions are waiting/i);
    expect(actionStubs.startWorkflowRun).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(within(confirm).getByRole('button', { name: 'Start anyway' }));
    });

    expect(actionStubs.startWorkflowRun).toHaveBeenCalledWith(SESSION, RUN);
  });

  it('offers the next step of a static run by its number', async () => {
    seed({ run: {}, agents: WAITING });
    renderHeader();

    expect(primaries()).toEqual(['Start step 2']);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start step 2' }));
    });

    expect(actionStubs.activateWorkflowAgent).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: SESSION, agentId: 'agent-build', bypassGate: false }),
    );
  });

  it('asks before it starts a step over a block', async () => {
    seed({
      run: {},
      agents: WAITING,
      questions: [questionFixture({ workflowRunId: RUN })],
    });
    renderHeader();

    fireEvent.click(screen.getByRole('button', { name: 'Start step 2' }));
    expect(actionStubs.activateWorkflowAgent).not.toHaveBeenCalled();
    const confirm = await screen.findByRole('group', { name: 'Start the next agent anyway?' });
    await act(async () => {
      fireEvent.click(within(confirm).getByRole('button', { name: 'Start anyway' }));
    });

    expect(actionStubs.activateWorkflowAgent).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: 'agent-build', bypassGate: true }),
    );
  });

  it('offers nothing to press on a finished run', () => {
    seed({
      run: { executionMode: 'dynamic', orchestrationOutcome: 'done' },
      agents: [stepAgent({ id: 'agent-plan', stepId: STEP_PLAN, status: 'completed' })],
    });
    renderHeader();

    expect(primaries()).toEqual([]);
    expect(screen.queryByRole('button', { name: 'Stop run' })).toBeNull();
  });

  it('restores an archived run and offers nothing else to press', () => {
    seed({ run: { executionMode: 'dynamic', discardedAt: TEST_NOW }, agents: LIVE });
    renderHeader();

    expect(primaries()).toEqual(['Restore']);
    expect(screen.queryByRole('button', { name: 'Stop run' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));

    expect(actionStubs.restoreWorkflow).toHaveBeenCalledWith(SESSION, RUN);
  });
});

describe('the run header Stop run', () => {
  it('confirms before it ends the run, and says what it keeps', async () => {
    seed({ run: { executionMode: 'dynamic', autoRun: true }, agents: LIVE });
    renderHeader();

    fireEvent.click(screen.getByRole('button', { name: 'Stop run' }));
    const confirm = await screen.findByRole('group', { name: 'Stop this run?' });
    expect(confirm.textContent).toContain('Everything already written stays.');
    expect(actionStubs.closeWorkflowRun).not.toHaveBeenCalled();
    fireEvent.click(within(confirm).getByRole('button', { name: 'Stop run' }));

    expect(actionStubs.closeWorkflowRun).toHaveBeenCalledWith(SESSION, RUN);
  });

  it('keeps the run when the confirm is cancelled', async () => {
    seed({ run: { executionMode: 'dynamic', autoRun: true }, agents: LIVE });
    renderHeader();

    fireEvent.click(screen.getByRole('button', { name: 'Stop run' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(actionStubs.closeWorkflowRun).not.toHaveBeenCalled();
    expect(screen.queryByRole('group', { name: 'Stop this run?' })).toBeNull();
  });

  it('offers Stop run once, in the header, and never in the overflow', () => {
    seed({ run: { executionMode: 'dynamic', autoRun: true }, agents: LIVE });
    renderHeader();

    expect(screen.getAllByRole('button', { name: 'Stop run' })).toHaveLength(1);
    expect(overflowItems()).not.toContain('Stop run');
  });

  it('offers no Stop run on a run that has not started', () => {
    seed({ run: { triggerMode: 'manual' }, agents: [] });
    renderHeader();

    expect(screen.queryByRole('button', { name: 'Stop run' })).toBeNull();
  });
});

describe('the run header overflow', () => {
  it('lists the six items of a live run, in the order of the groups', () => {
    seed({ run: { executionMode: 'dynamic', autoRun: true }, agents: LIVE });
    renderHeader();

    expect(overflowItems()).toEqual([
      'View diff',
      'Pause run',
      'Step routing',
      'Copy run summary',
      'Archive run',
      'Delete run',
    ]);
  });

  it('drops Pause run while the run is paused, and View diff without a mount', () => {
    seed({
      run: { executionMode: 'dynamic', orchestrationStop: { kind: 'paused', message: 'paused' } },
      agents: LIVE,
      hasMount: false,
    });
    renderHeader();

    expect(overflowItems()).toEqual([
      'Step routing',
      'Copy run summary',
      'Archive run',
      'Delete run',
    ]);
  });

  it('offers no Step routing on a static run, nor Pause run while no step is in flight', () => {
    seed({ run: {}, agents: WAITING });
    renderHeader();

    expect(overflowItems()).toEqual(['View diff', 'Copy run summary', 'Archive run', 'Delete run']);
  });

  it('leaves an archived run with View diff, Copy run summary and Delete run', () => {
    seed({ run: { executionMode: 'dynamic', discardedAt: TEST_NOW }, agents: LIVE });
    renderHeader();

    expect(overflowItems()).toEqual(['View diff', 'Copy run summary', 'Delete run']);
  });

  it('draws one menu trigger in the header, whatever the run state', () => {
    seed({ run: { executionMode: 'dynamic', autoRun: true }, agents: LIVE });
    renderHeader();

    expect(screen.getAllByRole('button', { name: /run actions$/ })).toHaveLength(1);
    expect(document.querySelectorAll('[aria-haspopup="menu"]')).toHaveLength(2);
  });

  it('offers Pause run while the orchestrator decides, even with no step running', () => {
    seed({ run: { executionMode: 'dynamic', autoRun: true }, agents: [] });
    useAppStore.setState({ orchestratingWorkflowRuns: { [RUN]: true } });
    renderHeader();

    expect(overflowItems()).toContain('Pause run');
  });

  it('offers Pause run on a static run while a step is in flight', () => {
    seed({ run: { autoRun: true }, agents: LIVE });
    renderHeader();

    expect(overflowItems()).toContain('Pause run');
  });

  it('offers no Pause run once you stopped the run', () => {
    seed({
      run: { orchestrationStop: { kind: 'operator', message: 'stopped' } },
      agents: LIVE,
    });
    renderHeader();

    expect(overflowItems()).not.toContain('Pause run');
  });

  it('pauses the run from Pause run', async () => {
    seed({ run: { executionMode: 'dynamic', autoRun: true }, agents: LIVE });
    renderHeader();

    fireEvent.click(screen.getByRole('button', { name: /run actions$/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: /Pause run/ }));
    });

    expect(actionStubs.pauseWorkflowRun).toHaveBeenCalledWith(SESSION, RUN);
  });

  it('asks the run to show its routing from Step routing, while it is on screen', async () => {
    seed({ run: { executionMode: 'dynamic', autoRun: true }, agents: LIVE });
    renderHeader();
    const asked = vi.fn();
    window.addEventListener(STEP_ROUTING_REQUEST_EVENT, asked);

    fireEvent.click(screen.getByRole('button', { name: /run actions$/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Step routing' }));
    });
    window.removeEventListener(STEP_ROUTING_REQUEST_EVENT, asked);

    expect(asked).toHaveBeenCalledTimes(1);
    const event: unknown = asked.mock.calls[0]?.[0];
    expect(event instanceof CustomEvent ? event.detail : null).toEqual({ runId: RUN });
  });

  it('archives behind a confirm, because the run is restorable', async () => {
    seed({ run: { executionMode: 'dynamic', autoRun: true }, agents: LIVE });
    renderHeader();

    fireEvent.click(screen.getByRole('button', { name: /run actions$/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Archive run' }));
    expect(actionStubs.discardWorkflow).not.toHaveBeenCalled();
    const confirm = await screen.findByRole('group', { name: 'Archive this run?' });
    await act(async () => {
      fireEvent.click(within(confirm).getByRole('button', { name: 'Archive' }));
    });

    await waitFor(() => expect(actionStubs.discardWorkflow).toHaveBeenCalledWith(SESSION, RUN));
  });
});

describe('the run header meta line', () => {
  it('reads steps, cost, spend cap and when to ask on one line', () => {
    seed({ run: { executionMode: 'dynamic', autoRun: true }, agents: LIVE });
    renderHeader();

    expect(screen.getByText('2 steps')).toBeDefined();
    expect(screen.getByRole('button', { name: /Set a spend cap/ })).toBeDefined();
    expect(screen.getByTestId('run-autonomy-fact').textContent).toBe('Run on its own');
  });

  it('changes when to ask from a popover, and keeps the choices out of the overflow', async () => {
    seed({ run: { executionMode: 'dynamic', autoRun: true }, agents: LIVE });
    renderHeader();

    fireEvent.click(screen.getByTestId('run-autonomy-fact'));
    expect(
      screen.getAllByRole('menuitemradio').map((item) => item.getAttribute('aria-checked')),
    ).toEqual(['false', 'false', 'true']);
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'Ask after the plan' }));
    });

    expect(actionStubs.setWorkflowRunAutonomy).toHaveBeenCalledWith(SESSION, RUN, 'plan');
    expect(overflowItems().join()).not.toContain('Ask');
  });

  it('does not set anything when the current choice is picked again', async () => {
    seed({ run: { executionMode: 'dynamic', autoRun: true }, agents: LIVE });
    renderHeader();

    fireEvent.click(screen.getByTestId('run-autonomy-fact'));
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'Run on its own' }));
    });

    expect(actionStubs.setWorkflowRunAutonomy).not.toHaveBeenCalled();
  });

  it('drops when to ask and the spend cap from an archived run', () => {
    seed({ run: { executionMode: 'dynamic', discardedAt: TEST_NOW }, agents: LIVE });
    renderHeader();

    expect(screen.queryByTestId('run-autonomy-fact')).toBeNull();
    expect(screen.queryByTestId('run-spend-limit-trigger')).toBeNull();
  });

  it('counts the steps of a static run as a position', () => {
    seed({ run: {}, agents: WAITING });
    renderHeader();

    expect(screen.getByText('Step 2 of 2')).toBeDefined();
  });
});
