// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../store/storyHarness')).dbModuleMock({
    updateWorkflowRunRulesSnapshot: async () => undefined,
    updateWorkflowRunOrchestrationStop: async () => undefined,
  }),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  DYNAMIC_RUN_ID,
  FLOW_SESSION_ID,
} from '../../../../../app/components/MockScene/scenes/flow-audit/fixtures';
import {
  PLAN_HOLD_PLAN,
  PLAN_HOLD_SESSION,
  seedWorkflowRunPlanHold,
} from '../../../../../app/components/MockScene/scenes/flow-audit/planHoldRun';
import { WorkflowRunDetail } from './WorkflowRunDetail';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ attachment_read: 'iVBORw0KGgo=' });
  seedWorkflowRunPlanHold();
});

afterEach(cleanup);

const Harness = () => {
  const session =
    useAppStore((state) => state.sessions.find((candidate) => candidate.id === FLOW_SESSION_ID)) ??
    PLAN_HOLD_SESSION;
  const run = session.workflowRuns.find((candidate) => candidate.id === DYNAMIC_RUN_ID);
  const workflow = useAppStore((state) =>
    state.sessionWorkflows[session.id]?.find((candidate) => candidate.id === run?.workflowId),
  );
  if (run === undefined || workflow === undefined) {
    return null;
  }
  return <WorkflowRunDetail session={session} run={run} workflow={workflow} />;
};

const renderPage = () =>
  render(
    <ToastProvider>
      <Harness />
    </ToastProvider>,
  );

const header = () => screen.getByTestId('run-header');

const primaries = (): ReadonlyArray<string> =>
  Array.from(header().querySelectorAll('button[data-variant="primary"]')).map(
    (button) => button.textContent ?? '',
  );

const openedDrawer = () => useAppStore.getState().drawer;

describe('WorkflowRunDetail while the plan waits', () => {
  it('offers Review plan as the one entry and no step to run until the plan is approved', async () => {
    renderPage();

    expect(primaries()).toEqual(['Review plan']);
    expect(screen.queryByRole('button', { name: /^Start step/ })).toBeNull();

    await act(async () => {
      await useAppStore.getState().approveWorkflowRunPlan(FLOW_SESSION_ID, DYNAMIC_RUN_ID);
    });

    await waitFor(() => expect(primaries()).toEqual([expect.stringMatching(/^Start step \d/)]));
    expect(screen.queryByRole('button', { name: 'Review plan' })).toBeNull();
    expect(screen.queryByTestId('workflow-run-plan-ready')).toBeNull();
  });

  it('opens the plan drawer from the header Review plan, over the run page', () => {
    renderPage();
    expect(openedDrawer()).toBeNull();

    fireEvent.click(within(header()).getByRole('button', { name: 'Review plan' }));

    expect(openedDrawer()).toMatchObject({
      kind: 'artifact-document',
      sessionId: FLOW_SESSION_ID,
      payload: { artifactId: PLAN_HOLD_PLAN.id },
    });
    expect(screen.getByRole('heading', { level: 1, name: 'Duplicate credit fix' })).toBeDefined();
  });

  it('says the plan is ready as a status, never as a second button', () => {
    renderPage();

    const status = screen.getByTestId('workflow-run-plan-ready');
    expect(status.tagName).not.toBe('BUTTON');
    expect(status.textContent).toBe('Plan ready');
  });

  it('draws no second entry to the plan on the planner row while the plan waits', () => {
    renderPage();

    const entries = screen.queryAllByRole('button', { name: /^(Review|Open|Approve) plan$/ });
    expect(entries.map((entry) => entry.textContent)).toEqual(['Review plan']);
  });
});
