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
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
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

describe('WorkflowRunDetail while the plan waits', () => {
  it('offers Approve plan and no step to run until the plan is approved', async () => {
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );

    expect(screen.getAllByRole('button', { name: 'Approve plan' }).length).toBeGreaterThan(0);
    expect(nextStep()).toBeNull();

    await act(async () => {
      await useAppStore.getState().approveWorkflowRunPlan(FLOW_SESSION_ID, DYNAMIC_RUN_ID);
    });

    await waitFor(() => expect(nextStep()?.textContent).toContain('Run next step'));
    expect(screen.queryByRole('button', { name: 'Approve plan' })).toBeNull();
  });
});
