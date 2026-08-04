import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, Workflow, WorkflowId, WorkspaceId } from '@goodboy/types';

const { invokeWorkflowUpsertSpy } = vi.hoisted(() => ({
  invokeWorkflowUpsertSpy: vi.fn(),
}));

vi.mock('../../../features/workflows/workflows', () => ({
  invokeWorkflowUpsert: invokeWorkflowUpsertSpy,
}));

import { makeWorkflowPreset } from './makeWorkflowPreset';

const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const WORKFLOW_ID = 'wf-1' as WorkflowId;
const NOW = '2026-08-04T00:00:00.000Z' as IsoDateTime;

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

const buildHarness = (seed: Workflow = workflow) => {
  const state: State = { phaseTemplates: { [WORKSPACE_ID]: [seed] } };
  const set = vi.fn((updater: (s: State) => Partial<State>) => {
    Object.assign(state, updater(state));
  });
  const get = (() => state) as never;
  const promote = makeWorkflowPreset(set as never, get);
  return { promote, state };
};

describe('makeWorkflowPreset', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('promotes a declined workflow into a preset', async () => {
    invokeWorkflowUpsertSpy.mockResolvedValue({ ...workflow, isPreset: true });
    const { promote, state } = buildHarness();

    await promote(WORKSPACE_ID, WORKFLOW_ID);

    expect(invokeWorkflowUpsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: WORKFLOW_ID, isPreset: true, origin: 'orchestrated' }),
    );
    expect(state.phaseTemplates[WORKSPACE_ID]?.[0]?.isPreset).toBe(true);
  });

  it('does nothing when the workflow is already a preset', async () => {
    const { promote } = buildHarness({ ...workflow, isPreset: true });

    await promote(WORKSPACE_ID, WORKFLOW_ID);

    expect(invokeWorkflowUpsertSpy).not.toHaveBeenCalled();
  });

  it('rolls back when the write fails', async () => {
    invokeWorkflowUpsertSpy.mockRejectedValue(new Error('offline'));
    const { promote, state } = buildHarness();

    await expect(promote(WORKSPACE_ID, WORKFLOW_ID)).rejects.toThrow('offline');
    expect(state.phaseTemplates[WORKSPACE_ID]?.[0]?.isPreset).toBe(false);
  });

  it('refuses a workflow that is not in the workspace', async () => {
    const { promote } = buildHarness();

    await expect(promote(WORKSPACE_ID, 'wf-missing' as WorkflowId)).rejects.toThrow('not found');
    expect(invokeWorkflowUpsertSpy).not.toHaveBeenCalled();
  });
});
