// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  brandId,
  type Agent,
  type AgentId,
  type IsoDateTime,
  type Session,
  type SessionId,
  type StepId,
  type Workflow,
  type WorkflowId,
  type WorkflowRun,
  type WorkflowRunId,
  type WorkspaceId,
} from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../../../test/sceneInvoke';
import { installFakeResizeObserver } from '../../../../test/fakeResizeObserver';
import { WorkTimeProvider } from '../../../workTreeModel/WorkTimeProvider';

let useAppStore: StoryStore;
let CentralColumn: typeof import('../../components/SessionOverviewPane/CentralColumn').CentralColumn;

const SESSION_ID = brandId<SessionId>({ value: 'session-harborline-pages' });
const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const WORKFLOW_ID = brandId<WorkflowId>({ value: 'workflow-fix-a-layout' });
const RUN_ID = brandId<WorkflowRunId>({ value: 'run-center-profile' });
const AT = brandId<IsoDateTime>({ value: '2026-10-22T09:00:00.000Z' });
const RUN_TITLE = 'Center the profile page';
const STEP_NAMES = ['Find the layout bug', 'Center the page wrapper', 'Check at three widths'];

const SESSION: Session = aSession({
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: 'Center every member page',
});

const stepIdOf = ({ index }: { readonly index: number }): StepId =>
  brandId<StepId>({ value: `step-layout-${index}` });

const WORKFLOW: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Fix a layout',
  description: '',
  steps: STEP_NAMES.map((name, ordinal) => ({
    id: stepIdOf({ index: ordinal }),
    workflowId: WORKFLOW_ID,
    ordinal,
    name,
    promptPrefix: '',
  })),
  createdAt: AT,
  updatedAt: AT,
};

const RUN: WorkflowRun = {
  id: RUN_ID,
  workflowId: WORKFLOW_ID,
  ordinal: 0,
  currentStep: 1,
  autoRun: false,
  triggerMode: 'immediate',
  executionMode: 'static',
  title: RUN_TITLE,
  createdAt: AT,
};

type AgentParams = {
  readonly index: number;
  readonly status: Agent['status'];
};

const stepAgent = ({ index, status }: AgentParams): Agent => ({
  id: brandId<AgentId>({ value: `agent-layout-${index}` }),
  sessionId: SESSION_ID,
  ordinal: index,
  name: STEP_NAMES[index] ?? 'Step',
  kind: index === 0 ? 'scout' : 'implementer',
  status,
  workflowRunId: RUN_ID,
  stepId: stepIdOf({ index }),
  startedAt: status === 'pending' ? undefined : AT,
});

beforeAll(async () => {
  installFakeResizeObserver();
  useAppStore = await importStore();
  ({ CentralColumn } = await import('../../components/SessionOverviewPane/CentralColumn'));
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  clearSceneInvoke();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
  useAppStore.setState({
    sessions: [{ ...SESSION, workflowRuns: [RUN] }],
    sessionWorkflows: { [SESSION_ID]: [WORKFLOW] },
    phaseTemplates: { [WORKSPACE_ID]: [WORKFLOW] },
    sessionPhaseRuns: {
      [SESSION_ID]: [
        stepAgent({ index: 0, status: 'completed' }),
        stepAgent({ index: 1, status: 'pending' }),
        stepAgent({ index: 2, status: 'pending' }),
      ],
    },
    sessionProjectMounts: { [SESSION_ID]: [] },
    sessionMounts: { [SESSION_ID]: [] },
  });
});

afterEach(cleanup);

const show = async () => {
  const session = useAppStore.getState().sessions[0] ?? SESSION;
  render(
    <ToastProvider>
      <WorkTimeProvider sessionId={SESSION_ID} workspaceId={WORKSPACE_ID}>
        <CentralColumn session={session} onLeadChange={() => undefined} />
      </WorkTimeProvider>
    </ToastProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
};

const runRow = () => screen.getByRole('region', { name: `Workflow: ${RUN_TITLE}` });

describe('a run row in the Running card', () => {
  it('starts with its kind and puts the gate of the run on the row as its one filled button', async () => {
    await show();

    const row = runRow();
    const start = within(row).getByRole('button', { name: 'Start step 2' });
    expect(start.getAttribute('data-variant')).toBe('primary');
    expect(row.textContent).toContain('Workflow');
    expect(
      document.querySelectorAll('[data-central-column] [data-variant="primary"]'),
    ).toHaveLength(1);
  });

  it('marks the running step with the role that runs it, for the role color', async () => {
    useAppStore.setState({
      sessionPhaseRuns: {
        [SESSION_ID]: [
          stepAgent({ index: 0, status: 'completed' }),
          stepAgent({ index: 1, status: 'running' }),
          stepAgent({ index: 2, status: 'pending' }),
        ],
      },
    });
    await show();

    const segments = [...runRow().querySelectorAll<HTMLElement>('[data-step-state]')];
    expect(segments.map((segment) => segment.dataset.stepState)).toEqual([
      'done',
      'running',
      'notStarted',
    ]);
    expect(segments[1]?.dataset.stepKind).toBe('implementer');
  });

  it('keeps the row and its button when the start fails, and says why', async () => {
    const activateWorkflowAgent = vi.fn(async () => {
      throw new Error('the worktree is locked');
    });
    const emitNotification = vi.fn(async () => undefined);
    useAppStore.setState({ activateWorkflowAgent, emitNotification });
    await show();

    await act(async () => {
      fireEvent.click(within(runRow()).getByRole('button', { name: 'Start step 2' }));
    });

    expect(activateWorkflowAgent).toHaveBeenCalledTimes(1);
    expect(emitNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        title: "The next step didn't start",
        body: 'the worktree is locked',
      }),
    );
    const again = within(runRow()).getByRole('button', { name: 'Start step 2' });
    expect(again.hasAttribute('disabled')).toBe(false);
  });

  it('leaves the gate of a running run out of Needs you', async () => {
    await show();

    expect(screen.queryByRole('region', { name: 'Needs you' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Start step 2' })).toHaveLength(1);
  });
});
