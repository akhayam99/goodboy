// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, Workflow, WorkflowId, WorkspaceId } from '@goodboy/types';
import { useAppStore, type AppStore } from '../../store';
import { draftFromWorkflow } from '../../../features/workflows/engine';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);

const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const WORKFLOW_A = 'workflow-a' as WorkflowId;
const WORKFLOW_B = 'workflow-b' as WorkflowId;

const workflowOf = (id: WorkflowId, name: string): Workflow => ({
  id,
  workspaceId: WORKSPACE_ID,
  name,
  description: '',
  steps: [],
  isPreset: true,
  origin: 'custom',
  createdAt: '2026-09-25T00:00:00.000Z' as IsoDateTime,
  updatedAt: '2026-09-25T00:00:00.000Z' as IsoDateTime,
});

const previousA = workflowOf(WORKFLOW_A, 'Ship releases');
const redraftedA = workflowOf(WORKFLOW_A, 'Ship releases, redrafted');
const workflowB = workflowOf(WORKFLOW_B, 'Triage incidents');

const savePhaseTemplate = vi.fn<AppStore['savePhaseTemplate']>(async () => redraftedA);

beforeEach(() => {
  savePhaseTemplate.mockClear();
  useAppStore.setState({
    ...useAppStore.getInitialState(),
    phaseTemplates: { [WORKSPACE_ID]: [redraftedA, workflowB] },
    workflowStudioDrafts: {},
    undoStack: [],
    undoNotices: [],
    savePhaseTemplate,
  });
});

describe('restoreWorkflowSnapshot', () => {
  it('leaves the draft of another workflow alone while restoring the captured one', async () => {
    const draftB = {
      workflowId: WORKFLOW_B,
      form: draftFromWorkflow({ workflow: workflowB }),
    };
    useAppStore.setState({ workflowStudioDrafts: { [WORKSPACE_ID]: draftB } });

    const restored = await useAppStore
      .getState()
      .restoreWorkflowSnapshot({ workspaceId: WORKSPACE_ID, snapshot: previousA });

    expect(restored).toBe(true);
    expect(savePhaseTemplate).toHaveBeenCalledWith(expect.objectContaining({ id: WORKFLOW_A }));
    expect(useAppStore.getState().workflowStudioDrafts[WORKSPACE_ID]).toEqual(draftB);
  });

  it('hands the snapshot to the open draft of the same workflow', async () => {
    useAppStore.setState({
      workflowStudioDrafts: {
        [WORKSPACE_ID]: {
          workflowId: WORKFLOW_A,
          form: draftFromWorkflow({ workflow: redraftedA }),
        },
      },
    });

    await useAppStore
      .getState()
      .restoreWorkflowSnapshot({ workspaceId: WORKSPACE_ID, snapshot: previousA });

    const draft = useAppStore.getState().workflowStudioDrafts[WORKSPACE_ID];
    expect(draft?.workflowId).toBe(WORKFLOW_A);
    expect(draft?.form.name).toBe('Ship releases');
    expect(draft?.restoreNonce).toBeDefined();
  });

  it('refuses a workflow that no longer exists', async () => {
    useAppStore.setState({ phaseTemplates: { [WORKSPACE_ID]: [workflowB] } });

    const restored = await useAppStore
      .getState()
      .restoreWorkflowSnapshot({ workspaceId: WORKSPACE_ID, snapshot: previousA });

    expect(restored).toBe(false);
    expect(savePhaseTemplate).not.toHaveBeenCalled();
  });
});

describe('undo entries bound to a context', () => {
  it('drops an entry whose target is gone and reports nothing to undo', async () => {
    const undo = vi.fn(async () => undefined);
    useAppStore
      .getState()
      .undoable({ message: 'Redrafted the steps.', isCurrent: () => false, undo });

    const result = await useAppStore.getState().undoLastOperation();

    expect(result).toBe(false);
    expect(undo).not.toHaveBeenCalled();
    expect(useAppStore.getState().undoStack).toEqual([]);
    expect(useAppStore.getState().undoNotices.at(-1)?.toast.message).toBe('Nothing to undo.');
  });

  it('still runs an entry whose target is current', async () => {
    const undo = vi.fn(async () => undefined);
    useAppStore
      .getState()
      .undoable({ message: 'Redrafted the steps.', isCurrent: () => true, undo });

    const result = await useAppStore.getState().undoLastOperation();

    expect(result).toBe(true);
    expect(undo).toHaveBeenCalledTimes(1);
  });
});
