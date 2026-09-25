import { describe, expect, it } from 'vitest';
import type { Workflow } from '@goodboy/types';
import { draftFromWorkflow } from '../../../workflows/engine';
import { editedStepKeys, stepsMatchPreset } from './presetEdits';

const preset = {
  id: 'wf-1',
  workspaceId: 'ws-1',
  name: 'Ship It',
  description: '',
  steps: [
    {
      id: 'step-b',
      workflowId: 'wf-1',
      ordinal: 1,
      name: 'Implement',
      role: 'implementer',
      promptPrefix: '',
      effort: 'medium',
    },
    {
      id: 'step-a',
      workflowId: 'wf-1',
      ordinal: 0,
      name: 'Scout',
      role: 'scout',
      promptPrefix: '',
      effort: 'medium',
    },
  ],
  isPreset: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
} as unknown as Workflow;

describe('preset edits', () => {
  it('matches an untouched copy of the preset in ordinal order', () => {
    const steps = draftFromWorkflow({ workflow: preset }).steps;

    expect(stepsMatchPreset({ steps, preset })).toBe(true);
    expect(editedStepKeys({ steps, preset }).size).toBe(0);
  });

  it('names only the steps that changed or were added', () => {
    const [scout, implement] = draftFromWorkflow({ workflow: preset }).steps;
    if (scout === undefined || implement === undefined) {
      throw new Error('expected two steps');
    }
    const renamed = { ...implement, name: 'Implement the fix' };
    const added = { ...scout, key: 'added', sourceStepId: null };
    const steps = [scout, renamed, added];

    expect(stepsMatchPreset({ steps, preset })).toBe(false);
    expect([...editedStepKeys({ steps, preset })]).toEqual([renamed.key, 'added']);
  });
});
