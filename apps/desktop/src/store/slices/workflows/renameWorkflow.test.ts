import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, Workflow, WorkflowId, WorkspaceId } from '@goodboy/types';

const { invokeWorkflowUpsertSpy } = vi.hoisted(() => ({
  invokeWorkflowUpsertSpy: vi.fn(),
}));

vi.mock('../../../features/workflows/workflows', () => ({
  invokeWorkflowUpsert: invokeWorkflowUpsertSpy,
}));

import { renameWorkflow } from './renameWorkflow';
import { isWorkflowTitleUserEdited } from './workflowTitleUserEdited';

const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const WORKFLOW_ID = 'wf-1' as WorkflowId;
const NOW = '2026-07-23T00:00:00.000Z' as IsoDateTime;

const workflow: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Orchestrated workflow',
  description: 'Steps are decided at runtime from the latest results.',
  goal: 'ship the thing',
  processText: 'do the process',
  steps: [],
  isPreset: false,
  origin: 'orchestrated',
  createdAt: NOW,
  updatedAt: NOW,
};

type State = {
  phaseTemplates: Record<WorkspaceId, ReadonlyArray<Workflow>>;
};

const buildHarness = (stateOverrides: Partial<State> = {}) => {
  const state: State = {
    phaseTemplates: { [WORKSPACE_ID]: [workflow] },
    ...stateOverrides,
  };
  const set = vi.fn((updater: (s: State) => Partial<State>) => {
    Object.assign(state, updater(state));
  });
  const get = (() => state) as unknown as Parameters<ReturnType<typeof renameWorkflow>>[0];
  const rename = renameWorkflow(
    set as unknown as Parameters<typeof renameWorkflow>[0],
    get as unknown as Parameters<typeof renameWorkflow>[1],
  );
  return { rename, state, set };
};

describe('renameWorkflow', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('trims the name and persists through workflow_upsert', async () => {
    invokeWorkflowUpsertSpy.mockResolvedValue({ ...workflow, name: 'Ship auth' });
    const { rename, state } = buildHarness();

    await rename(WORKSPACE_ID, WORKFLOW_ID, '  Ship auth  ');

    expect(invokeWorkflowUpsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: WORKFLOW_ID, name: 'Ship auth', steps: [] }),
    );
    expect(state.phaseTemplates[WORKSPACE_ID]?.[0]?.name).toBe('Ship auth');
  });

  it('refuses an empty name and never calls workflow_upsert', async () => {
    const { rename } = buildHarness();

    await expect(rename(WORKSPACE_ID, WORKFLOW_ID, '   ')).rejects.toThrow();
    expect(invokeWorkflowUpsertSpy).not.toHaveBeenCalled();
  });

  it('reconciles with the de-duplicated name the backend returns', async () => {
    invokeWorkflowUpsertSpy.mockResolvedValue({ ...workflow, name: 'Ship auth 2' });
    const { rename, state } = buildHarness();

    await rename(WORKSPACE_ID, WORKFLOW_ID, 'Ship auth');

    expect(state.phaseTemplates[WORKSPACE_ID]?.[0]?.name).toBe('Ship auth 2');
  });

  it('rolls back the optimistic rename when the write fails', async () => {
    invokeWorkflowUpsertSpy.mockRejectedValue(new Error('offline'));
    const { rename, state } = buildHarness();

    await expect(rename(WORKSPACE_ID, WORKFLOW_ID, 'Ship auth')).rejects.toThrow('offline');

    expect(state.phaseTemplates[WORKSPACE_ID]?.[0]?.name).toBe('Orchestrated workflow');
  });

  it('marks the workflow title as user-edited', async () => {
    invokeWorkflowUpsertSpy.mockResolvedValue({ ...workflow, name: 'Ship auth' });
    const { rename } = buildHarness();

    await rename(WORKSPACE_ID, WORKFLOW_ID, 'Ship auth');

    expect(isWorkflowTitleUserEdited(WORKFLOW_ID)).toBe(true);
  });
});
