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
  return <WorkflowRunDetail session={session} workflowRunId={DYNAMIC_RUN_ID} />;
};

const nextStep = () => screen.queryByTestId('workflow-next-step-cta');

const renderPage = () =>
  render(
    <ToastProvider>
      <Harness />
    </ToastProvider>,
  );

const lifecycle = () => screen.getByRole('group', { name: 'Run lifecycle actions' });

const openedDrawer = () => useAppStore.getState().drawer;

describe('WorkflowRunDetail while the plan waits', () => {
  it('offers Review plan and no step to run until the plan is approved', async () => {
    renderPage();

    expect(within(lifecycle()).getByRole('button', { name: 'Review plan' })).toBeDefined();
    expect(within(lifecycle()).queryByRole('button', { name: 'Approve plan' })).toBeNull();
    expect(nextStep()).toBeNull();

    await act(async () => {
      await useAppStore.getState().approveWorkflowRunPlan(FLOW_SESSION_ID, DYNAMIC_RUN_ID);
    });

    await waitFor(() => expect(nextStep()?.textContent).toContain('Run next step'));
    expect(screen.queryByRole('button', { name: 'Review plan' })).toBeNull();
    expect(screen.queryByTestId('workflow-run-plan-ready')).toBeNull();
  });

  it('opens the plan drawer from the header Review plan, over the run page', () => {
    renderPage();
    expect(openedDrawer()).toBeNull();

    fireEvent.click(within(lifecycle()).getByRole('button', { name: 'Review plan' }));

    expect(openedDrawer()).toMatchObject({
      kind: 'artifact-document',
      sessionId: FLOW_SESSION_ID,
      payload: { artifactId: PLAN_HOLD_PLAN.id },
    });
    expect(screen.getByRole('heading', { name: 'Duplicate credit fix' })).toBeDefined();
  });

  it('opens the same drawer from the Plan ready status of the static run', () => {
    renderPage();

    fireEvent.click(screen.getByTestId('workflow-run-plan-ready'));

    expect(openedDrawer()).toMatchObject({
      kind: 'artifact-document',
      payload: { artifactId: PLAN_HOLD_PLAN.id },
    });
  });

  it('approves from the overflow, lifts the hold and says so in one toast', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /run controls$/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Approve plan' }));
    });

    await waitFor(() => expect(nextStep()?.textContent).toContain('Run next step'));
    expect(screen.getAllByText('Plan approved')).toHaveLength(1);
    expect(screen.getByText('The run goes on')).toBeDefined();
    expect(screen.queryByRole('menuitem', { name: 'Approve plan' })).toBeNull();
  });
});
