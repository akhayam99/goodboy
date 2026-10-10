// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../store/storyHarness')).dbModuleMock({
    listGoalAttachmentsForRun: async () => [],
    markAgentViewed: async () => undefined,
  }),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { Agent, MountId, WorkflowRun } from '@goodboy/types';
import { TEST_NOW, nextProjectId } from '@goodboy/types/testing';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import {
  RUN,
  SESSION,
  STEP_BUILD,
  STEP_PLAN,
  WORKSPACE,
  mountFixture,
  runFixture,
  seedActionState,
  sessionFixture,
  stepAgent,
  workflowFixture,
} from '../../../../__tests__/helpers/actionFixtures';
import { WorkflowRunDetail } from '../SessionWorkspace/parts/WorkflowRunDetail';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const PLAN_DONE: Agent = stepAgent({ id: 'agent-plan', stepId: STEP_PLAN, status: 'completed' });
const BUILD_PENDING: Agent = stepAgent({
  id: 'agent-build',
  stepId: STEP_BUILD,
  status: 'pending',
});
const BUILD_DONE: Agent = stepAgent({ id: 'agent-build', stepId: STEP_BUILD, status: 'completed' });

type Setup = {
  readonly run?: Partial<WorkflowRun>;
  readonly agents?: ReadonlyArray<Agent>;
  readonly mountCount?: number;
};

const isMountId = (value: string): value is MountId => value.startsWith('mount-');

type MountIdParams = {
  readonly index: number;
};

const mountIdOf = ({ index }: MountIdParams): MountId => {
  const id = `mount-${index}`;
  if (!isMountId(id)) {
    throw new Error('a mount id starts with mount-');
  }
  return id;
};

const seed = ({ run = {}, agents = [PLAN_DONE, BUILD_PENDING], mountCount = 1 }: Setup) => {
  const workflow = { ...workflowFixture(), goal: 'template goal', processText: 'plan, then build' };
  seedActionState({
    useAppStore,
    seed: {
      session: sessionFixture({
        workflowRuns: [runFixture({ goal: 'just the auth module', ...run })],
      }),
      workflows: [workflow],
      agents,
      mounts: Array.from({ length: mountCount }, (_value, index) =>
        mountFixture({
          mountId: mountIdOf({ index }),
          projectId: nextProjectId(),
          mountName: `ledger-core-${index}`,
          worktreePath: `/work/harborline/ledger-core-${index}`,
        }),
      ),
    },
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
  return <WorkflowRunDetail session={session} run={run} workflow={workflow} />;
};

const renderPage = () =>
  render(
    <ToastProvider>
      <Page />
    </ToastProvider>,
  );

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ workspaces_with_unread: [], attachment_read: 'iVBORw0KGgo=' });
});

afterEach(() => {
  cleanup();
});

describe('the run body order', () => {
  it('puts the steps first, then the recap, the goal and its attachments', () => {
    seed({ run: { orchestratorSummary: '- shipped the gate' } });
    renderPage();

    const steps = screen.getByTestId('run-tree');
    const recap = screen.getByTestId('workflow-run-summary');
    const goal = screen.getByRole('region', { name: 'What you asked for' });

    expect(steps.compareDocumentPosition(recap) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(recap.compareDocumentPosition(goal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(recap.textContent).toContain('shipped the gate');
  });

  it('takes no room on a run the orchestrator never recapped', () => {
    seed({});
    renderPage();

    expect(screen.queryByTestId('workflow-run-summary')).toBeNull();
  });

  it('draws the scroll edge line once, under the pinned header', () => {
    seed({});
    renderPage();

    expect(document.querySelectorAll('[data-slot="scroll-edge"]')).toHaveLength(1);
  });

  it('follows the empty state contract when the run has no agents yet', () => {
    seed({ agents: [] });
    renderPage();

    expect(screen.getByText('No agents yet')).toBeDefined();
    expect(screen.getByText('The run starts its first step here.')).toBeDefined();
  });

  it('opens the chat of a step when its row is picked', () => {
    seed({});
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /^Step 1, Plan/ }));

    expect(useAppStore.getState().selectedAgentId[SESSION]).toBe('agent-plan');
  });
});

describe('the run goal', () => {
  it('shows the goal the run was started with, not the template goal', () => {
    seed({});
    renderPage();

    expect(screen.getByText('just the auth module')).toBeDefined();
    expect(screen.queryByText('template goal')).toBeNull();
  });

  it('falls back to the template goal when the run carries none', () => {
    seed({ run: { goal: undefined } });
    renderPage();

    expect(screen.getByText('template goal')).toBeDefined();
  });

  it('keeps the described process behind a disclosure', () => {
    seed({});
    renderPage();

    expect(screen.queryByText('plan, then build')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /how you described the process/i }));
    expect(screen.getByText('plan, then build')).toBeDefined();
  });
});

describe('the run write destination', () => {
  it('shows the automatic destination when the session has two mounts, inside the steps', () => {
    seed({ mountCount: 2 });
    renderPage();

    const control = screen.getByRole('button', { name: /automatic/i });
    const scroller = document.querySelector('[data-slot="scroll-edge"]')?.previousElementSibling;
    expect(scroller?.contains(control)).toBe(true);
  });

  it('hides the destination with one mount, and on an archived run', () => {
    seed({ mountCount: 1 });
    const { unmount } = renderPage();
    expect(screen.queryByRole('button', { name: /automatic/i })).toBeNull();
    unmount();

    seed({ mountCount: 2, run: { discardedAt: TEST_NOW } });
    renderPage();
    expect(screen.queryByRole('button', { name: /automatic/i })).toBeNull();
  });
});

describe('the run next action', () => {
  it('lifts the next action of a failed step above the steps, scoped to the run', () => {
    seed({
      agents: [PLAN_DONE, stepAgent({ id: 'agent-build', stepId: STEP_BUILD, status: 'failed' })],
    });
    renderPage();

    const strip = screen.getByTestId('next-action-strip');
    const steps = screen.getByTestId('run-tree');
    expect(strip.getAttribute('data-kind')).toBe('recover');
    expect(strip.compareDocumentPosition(steps) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('drops the next action on an archived run', () => {
    seed({
      run: { discardedAt: TEST_NOW },
      agents: [PLAN_DONE, stepAgent({ id: 'agent-build', stepId: STEP_BUILD, status: 'failed' })],
    });
    renderPage();

    expect(screen.queryByTestId('next-action-strip')).toBeNull();
  });
});

describe('the run body on a dynamic run', () => {
  const dynamic: Partial<WorkflowRun> = { executionMode: 'dynamic' };

  it('keeps an in-between run out of the completed state, with the phase in the status line', () => {
    seed({ run: dynamic, agents: [PLAN_DONE, BUILD_DONE] });
    renderPage();

    expect(screen.queryByText('Completed')).toBeNull();
    expect(screen.getByTestId('orchestrator-state').textContent).toContain('Waiting for your go');
    expect(screen.queryByTestId('workflow-orchestrator-failed')).toBeNull();
  });

  it('marks the run completed only on a persisted done outcome', () => {
    seed({ run: { ...dynamic, orchestrationOutcome: 'done' }, agents: [PLAN_DONE, BUILD_DONE] });
    renderPage();

    expect(screen.getByText('Completed')).toBeDefined();
  });

  it('counts the steps a dynamic run took, and the agents only when they differ', () => {
    seed({ run: dynamic, agents: [PLAN_DONE, BUILD_DONE] });
    const { unmount } = renderPage();
    expect(screen.getByText('2 steps')).toBeDefined();
    expect(screen.queryByText(/^\d+ agents?$/)).toBeNull();
    unmount();

    seed({
      run: dynamic,
      agents: [
        PLAN_DONE,
        BUILD_DONE,
        stepAgent({ id: 'agent-extra', stepId: STEP_BUILD, status: 'completed' }),
      ],
    });
    renderPage();
    expect(screen.getByText('3 agents')).toBeDefined();
  });

  it('offers the spend cap next to the cost, showing the cap once set', () => {
    seed({ run: { ...dynamic, spendLimitUsd: 20 }, agents: [PLAN_DONE, BUILD_DONE] });
    renderPage();

    expect(screen.getAllByTestId('run-spend-limit-trigger')[0]?.textContent).toContain(
      'Spend cap $20.00',
    );
  });

  it('offers add step on a blocked run, and withholds it while the orchestrator chooses', () => {
    seed({
      run: { ...dynamic, orchestrationOutcome: 'blocked', orchestrationReason: 'it needs a call' },
      agents: [PLAN_DONE, BUILD_DONE],
    });
    const { unmount } = renderPage();
    expect(screen.getByRole('button', { name: /add step/i })).toBeDefined();
    unmount();

    seed({ run: dynamic, agents: [PLAN_DONE, BUILD_DONE] });
    useAppStore.setState({ orchestratingWorkflowRuns: { [RUN]: true } });
    renderPage();
    expect(screen.getByRole('button', { name: /add step/i }).hasAttribute('disabled')).toBe(true);
  });

  it('offers add step again on a completed run', () => {
    seed({ run: { ...dynamic, orchestrationOutcome: 'done' }, agents: [PLAN_DONE, BUILD_DONE] });
    renderPage();

    expect(screen.getByRole('button', { name: /add step/i })).toBeDefined();
  });
});

describe('the run body on a closed run', () => {
  it('reads as closed by you, with no Stop run, no autorun and no next action', async () => {
    seed({
      run: {
        orchestrationOutcome: 'done',
        orchestrationStop: { kind: 'closed', message: 'Closed by you' },
      },
      agents: [
        stepAgent({ id: 'agent-plan', stepId: STEP_PLAN, status: 'failed' }),
        stepAgent({ id: 'agent-build', stepId: STEP_BUILD, status: 'skipped' }),
      ],
    });
    renderPage();
    await act(async () => undefined);

    const header = screen.getByTestId('run-header');
    expect(within(header).getByText('Closed')).toBeDefined();
    expect(within(header).queryByRole('button', { name: 'Stop run' })).toBeNull();
    expect(screen.queryByTestId('workflow-autorun-toggle')).toBeNull();
    expect(screen.queryByTestId('next-action-strip')).toBeNull();
  });
});

describe('the run time left', () => {
  it('gives the time the steps left usually take, and nothing without enough history', () => {
    seed({});
    const { unmount } = renderPage();
    expect(screen.queryByTestId('run-time-left')).toBeNull();
    unmount();

    useAppStore.setState({
      workspaceDurationHistory: {
        [WORKSPACE]: {
          steps: [4, 5, 6, 7, 8, 9, 10, 12].map((minutes) => ({
            role: 'custom',
            provider: 'anthropic',
            model: 'claude-sonnet-5',
            effort: null,
            activeMs: minutes * 60_000,
            costUsd: null,
            endedAtMs: Date.now() - 60_000,
          })),
          turns: [],
          everyWorkspace: { steps: [], turns: [] },
          orchestratedRuns: [],
        },
      },
    });
    renderPage();

    const meta = screen.getByText('Step 2 of 2').parentElement;
    if (meta === null) {
      throw new Error('the step count has no meta row');
    }
    expect(within(meta).getByTestId('run-time-left').textContent).toBe('usually 6-9m');
  });
});
