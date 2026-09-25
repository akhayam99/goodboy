import { describe, expect, it } from 'vitest';
import type { StepDef, StepDefId, WorkspaceId } from '@goodboy/types';
import {
  savedStepGroups,
  savedStepNote,
  stepDefArgsFromDraft,
  stepDraftFromSavedStep,
} from './savedSteps';

const def = (overrides: Partial<StepDef> = {}): StepDef => ({
  id: 'lib-replay' as StepDefId,
  workspaceId: 'ws-1' as WorkspaceId,
  role: 'tester',
  name: 'Dry run replay',
  promptPrefix: 'Replay settled batches.\nThen compare the ledger-core totals.',
  createdAt: '2026-09-25T12:00:00.000Z' as StepDef['createdAt'],
  updatedAt: '2026-09-25T12:00:00.000Z' as StepDef['updatedAt'],
  ...overrides,
});

describe('savedStepGroups', () => {
  it('puts the built-in steps from code before the workspace rows', () => {
    const groups = savedStepGroups({ defs: [def()] });
    expect(groups.builtin.map((step) => step.id)).toContain('seed_scout');
    expect(groups.builtin.every((step) => step.isBuiltin)).toBe(true);
    expect(groups.workspace.map((step) => step.name)).toEqual(['Dry run replay']);
  });
});

describe('savedStepNote', () => {
  it('names the step a copy is based on before its first line', () => {
    const groups = savedStepGroups({ defs: [def({ baseStepId: 'seed_tester' as StepDefId })] });
    const [copy] = groups.workspace;
    expect(copy && savedStepNote({ step: copy, groups })).toBe(
      'Based on Test · Replay settled batches.',
    );
  });

  it('shows only the first line when the step has no base', () => {
    const groups = savedStepGroups({ defs: [def()] });
    const [step] = groups.workspace;
    expect(step && savedStepNote({ step, groups })).toBe('Replay settled batches.');
  });
});

describe('stepDraftFromSavedStep', () => {
  it('links the draft to the saved step and keeps its expected output', () => {
    const groups = savedStepGroups({ defs: [] });
    const scout = groups.builtin.find((step) => step.id === 'seed_scout');
    if (scout === undefined) {
      throw new Error('scout missing');
    }
    const draft = stepDraftFromSavedStep({ step: scout });
    expect(draft).toMatchObject({
      libraryStepId: 'seed_scout',
      sourceStepId: null,
      role: 'scout',
      name: 'Scout',
      provider: '',
      model: '',
    });
    expect(draft.expectedOutput).toBe(scout.expectedOutput);
  });
});

describe('stepDefArgsFromDraft', () => {
  it('always saves into a workspace and keeps the base step', () => {
    const [step] = savedStepGroups({ defs: [def({ expectedOutput: 'A replay log' })] }).workspace;
    if (step === undefined) {
      throw new Error('step missing');
    }
    const args = stepDefArgsFromDraft({
      draft: stepDraftFromSavedStep({ step }),
      workspaceId: 'ws-1' as WorkspaceId,
      id: step.id,
      baseStepId: 'seed_tester' as StepDefId,
    });
    expect(args).toMatchObject({
      id: 'lib-replay',
      workspaceId: 'ws-1',
      baseStepId: 'seed_tester',
      expectedOutput: 'A replay log',
    });
  });
});
