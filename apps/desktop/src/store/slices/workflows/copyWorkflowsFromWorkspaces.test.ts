import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  IsoDateTime,
  Step,
  StepDefId,
  StepId,
  Workflow,
  WorkflowId,
  WorkspaceId,
} from '@goodboy/types';
import type { AppStore } from '../../store';
import type { SetFn } from './types';

const { invokeWorkflowListSpy, invokeWorkflowUpsertSpy } = vi.hoisted(() => ({
  invokeWorkflowListSpy: vi.fn(),
  invokeWorkflowUpsertSpy: vi.fn(),
}));

vi.mock('../../../features/workflows/workflows', () => ({
  invokeWorkflowList: invokeWorkflowListSpy,
  invokeWorkflowUpsert: invokeWorkflowUpsertSpy,
}));

import { copyWorkflowsFromWorkspaces } from './copyWorkflowsFromWorkspaces';

const SOURCE_WORKSPACE_ID = 'workspace-source' as WorkspaceId;
const TARGET_WORKSPACE_ID = 'workspace-target' as WorkspaceId;
const SOURCE_WORKFLOW_ID = 'workflow-source' as WorkflowId;
const NOW = '2026-09-07T12:00:00.000Z' as IsoDateTime;

const sourceStep: Step = {
  id: 'step-source' as StepId,
  workflowId: SOURCE_WORKFLOW_ID,
  libraryStepId: 'library-step-source' as StepDefId,
  role: 'reviewer',
  ordinal: 3,
  name: 'Review',
  promptPrefix: 'Review the implementation.',
  expectedOutput: 'A prioritized findings list.',
  providerOverride: 'codex',
  modelOverride: 'gpt-5.6-terra',
  effort: 'high',
  verbosity: 'verbose',
  orchestratorReason: 'The implementation is ready for review.',
};

const sourceWorkflow: Workflow = {
  id: SOURCE_WORKFLOW_ID,
  workspaceId: SOURCE_WORKSPACE_ID,
  name: 'Review and resolve',
  description: 'Review changes and resolve findings.',
  goal: 'Land a reviewed change',
  processText: 'Review first, then resolve every finding.',
  isPreset: true,
  origin: 'custom',
  steps: [sourceStep],
  createdAt: NOW,
  updatedAt: NOW,
};

const targetRow = (name: string, overrides: Partial<Workflow> = {}): Workflow => ({
  ...sourceWorkflow,
  id: `workflow-${name}` as WorkflowId,
  workspaceId: TARGET_WORKSPACE_ID,
  name,
  ...overrides,
});

const buildHarness = () => {
  let state = {
    phaseTemplates: { [TARGET_WORKSPACE_ID]: [] },
  } as unknown as AppStore;
  const set: SetFn = (update) => {
    const patch = typeof update === 'function' ? update(state) : update;
    state = { ...state, ...patch };
  };
  return {
    copy: copyWorkflowsFromWorkspaces({ set }),
    getState: () => state,
  };
};

const upsertedNames = (): ReadonlyArray<string> =>
  invokeWorkflowUpsertSpy.mock.calls.map((call) => (call[0] as { name: string }).name);

describe('copyWorkflowsFromWorkspaces', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invokeWorkflowUpsertSpy.mockImplementation(async (args: Workflow) => ({
      ...args,
      createdAt: NOW,
      updatedAt: NOW,
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('copies a preset into the target workspace without links to its own saved steps', async () => {
    invokeWorkflowListSpy.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000001')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000002');
    const { copy, getState } = buildHarness();

    const saved = await copy({
      picks: [{ workflow: sourceWorkflow, sourceWorkspaceName: 'Northwind' }],
      targetWorkspaceId: TARGET_WORKSPACE_ID,
    });

    expect(invokeWorkflowUpsertSpy).toHaveBeenCalledWith({
      id: '00000000-0000-4000-8000-000000000001',
      workspaceId: TARGET_WORKSPACE_ID,
      name: 'Review and resolve',
      description: 'Review changes and resolve findings.',
      goal: 'Land a reviewed change',
      processText: 'Review first, then resolve every finding.',
      isPreset: true,
      origin: 'custom',
      steps: [
        {
          id: '00000000-0000-4000-8000-000000000002',
          role: 'reviewer',
          ordinal: 3,
          name: 'Review',
          promptPrefix: 'Review the implementation.',
          expectedOutput: 'A prioritized findings list.',
          providerOverride: 'codex',
          modelOverride: 'gpt-5.6-terra',
          effort: 'high',
          verbosity: 'verbose',
          orchestratorReason: 'The implementation is ready for review.',
        },
      ],
    });
    expect(saved).toHaveLength(1);
    expect(getState().phaseTemplates[TARGET_WORKSPACE_ID]?.map((row) => row.name)).toEqual([
      'Review and resolve',
    ]);
  });

  it('keeps a link to a built-in step, which every workspace shares', async () => {
    invokeWorkflowListSpy.mockResolvedValue([]);
    const { copy } = buildHarness();

    await copy({
      picks: [
        {
          workflow: {
            ...sourceWorkflow,
            steps: [{ ...sourceStep, libraryStepId: 'seed_scout' as StepDefId }],
          },
          sourceWorkspaceName: 'Northwind',
        },
      ],
      targetWorkspaceId: TARGET_WORKSPACE_ID,
    });

    expect(invokeWorkflowUpsertSpy.mock.calls[0]?.[0].steps[0]).toMatchObject({
      libraryStepId: 'seed_scout',
    });
  });

  it('imports several workflows in order and names a collision after its workspace', async () => {
    invokeWorkflowListSpy
      .mockResolvedValueOnce([
        targetRow('Review and resolve'),
        targetRow('Review and resolve (Northwind)'),
        targetRow('Hotfix lane', { deletedAt: NOW }),
      ])
      .mockResolvedValueOnce([]);
    const { copy } = buildHarness();

    await copy({
      picks: [
        { workflow: sourceWorkflow, sourceWorkspaceName: 'Northwind' },
        {
          workflow: { ...sourceWorkflow, id: 'workflow-hotfix' as WorkflowId, name: 'Hotfix lane' },
          sourceWorkspaceName: 'Acme',
        },
        {
          workflow: { ...sourceWorkflow, id: 'workflow-acme' as WorkflowId },
          sourceWorkspaceName: 'Acme',
        },
      ],
      targetWorkspaceId: TARGET_WORKSPACE_ID,
    });

    expect(upsertedNames()).toEqual([
      'Review and resolve (Northwind) 2',
      'Hotfix lane',
      'Review and resolve (Acme)',
    ]);
  });

  it('refreshes the list with the copies that landed when a later one fails', async () => {
    invokeWorkflowListSpy.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    invokeWorkflowUpsertSpy
      .mockImplementationOnce(async (args: Workflow) => ({
        ...args,
        createdAt: NOW,
        updatedAt: NOW,
      }))
      .mockRejectedValueOnce(new Error('target database unavailable'));
    const { copy, getState } = buildHarness();

    await expect(
      copy({
        picks: [
          { workflow: sourceWorkflow, sourceWorkspaceName: 'Northwind' },
          {
            workflow: {
              ...sourceWorkflow,
              id: 'workflow-2' as WorkflowId,
              name: 'Ledger migration',
            },
            sourceWorkspaceName: 'Northwind',
          },
        ],
        targetWorkspaceId: TARGET_WORKSPACE_ID,
      }),
    ).rejects.toThrow('target database unavailable');
    expect(getState().phaseTemplates[TARGET_WORKSPACE_ID]?.map((row) => row.name)).toEqual([
      'Review and resolve',
    ]);
  });

  it('rejects a library or orchestrated workflow before writing anything', async () => {
    const { copy } = buildHarness();

    await expect(
      copy({
        picks: [
          { workflow: { ...sourceWorkflow, origin: 'library' }, sourceWorkspaceName: 'Northwind' },
        ],
        targetWorkspaceId: TARGET_WORKSPACE_ID,
      }),
    ).rejects.toThrow('only custom presets can be imported');
    await expect(
      copy({
        picks: [
          {
            workflow: { ...sourceWorkflow, origin: 'orchestrated' },
            sourceWorkspaceName: 'Northwind',
          },
        ],
        targetWorkspaceId: TARGET_WORKSPACE_ID,
      }),
    ).rejects.toThrow('only custom presets can be imported');
    expect(invokeWorkflowUpsertSpy).not.toHaveBeenCalled();
  });

  it('accepts a legacy workflow with no origin', async () => {
    invokeWorkflowListSpy.mockResolvedValue([]);
    const { copy } = buildHarness();

    const saved = await copy({
      picks: [
        { workflow: { ...sourceWorkflow, origin: undefined }, sourceWorkspaceName: 'Northwind' },
      ],
      targetWorkspaceId: TARGET_WORKSPACE_ID,
    });

    expect(saved).toHaveLength(1);
  });
});
