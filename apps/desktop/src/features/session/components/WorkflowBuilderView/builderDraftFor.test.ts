import { describe, expect, it } from 'vitest';
import type { IsoDateTime, StepId, Workflow, WorkflowId, WorkspaceId } from '@goodboy/types';
import { builderDraftFor } from './builderDraftFor';

const NOW = '2026-09-27T09:00:00.000Z' as IsoDateTime;

const PRESET: Workflow = {
  id: 'wf-fix-bug' as WorkflowId,
  workspaceId: 'ws-harborline' as WorkspaceId,
  name: 'Fix a bug',
  description: 'Reproduce, fix, verify.',
  isPreset: true,
  origin: 'library',
  createdAt: NOW,
  updatedAt: NOW,
  steps: [
    {
      id: 'step-verify' as StepId,
      workflowId: 'wf-fix-bug' as WorkflowId,
      ordinal: 1,
      name: 'Verify',
      role: 'reviewer',
      promptPrefix: 'Check the fix in ledger-core.',
    },
    {
      id: 'step-fix' as StepId,
      workflowId: 'wf-fix-bug' as WorkflowId,
      ordinal: 0,
      name: 'Fix',
      role: 'implementer',
      promptPrefix: 'Fix the bug in ledger-core.',
    },
  ],
} as Workflow;

const GOAL = 'Stop crediting an invoice twice.';

describe('builderDraftFor', () => {
  it('opens a preset on the preset approach with its steps and the session goal', () => {
    const draft = builderDraftFor({ choice: { kind: 'preset', workflow: PRESET }, goal: GOAL });

    expect(draft.mode).toBe('preset');
    expect(draft.selectedPresetId).toBe(PRESET.id);
    expect(draft.basePresetId).toBe(PRESET.id);
    expect(draft.goalText).toBe(GOAL);
    expect(draft.workflow.steps.map((step) => step.name)).toEqual(['Fix', 'Verify']);
  });

  it('opens a custom workflow with no steps yet', () => {
    const draft = builderDraftFor({ choice: { kind: 'custom' }, goal: '' });

    expect(draft.mode).toBe('custom');
    expect(draft.workflow.steps).toEqual([]);
    expect(draft.selectedPresetId).toBeNull();
  });

  it('opens the orchestrated approach', () => {
    expect(builderDraftFor({ choice: { kind: 'orchestrated' }, goal: GOAL }).mode).toBe('dynamic');
  });
});
