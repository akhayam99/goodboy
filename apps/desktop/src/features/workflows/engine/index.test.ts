import { describe, expect, it, vi } from 'vitest';
import type { StepDef, Workflow } from '@goodboy/types';
import {
  addStep,
  draftFromPlannerSteps,
  draftFromStepDef,
  draftFromWorkflow,
  removeStep,
  reorderSteps,
  stepDraftWithModel,
  updateStep,
  upsertArgsFromDraft,
  validateDraft,
} from './index';

vi.stubGlobal('crypto', { randomUUID: vi.fn(() => `key-${Math.random()}`) });

const workflow = {
  id: 'workflow-1',
  workspaceId: 'workspace-1',
  name: ' Ship ',
  description: ' Prepare release ',
  goal: ' Deliver ',
  steps: [
    {
      id: 'step-2',
      workflowId: 'workflow-1',
      ordinal: 1,
      name: 'Publish',
      promptPrefix: 'Publish it',
      role: 'implementer',
    },
    {
      id: 'step-1',
      workflowId: 'workflow-1',
      ordinal: 0,
      name: 'Review',
      promptPrefix: 'Review it',
      expectedOutput: 'Findings',
      role: 'reviewer',
      providerOverride: 'anthropic',
      modelOverride: 'claude-sonnet-4-5',
      effort: 'high',
      verbosity: 'detailed',
    },
  ],
  isPreset: true,
  origin: 'custom',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
} as unknown as Workflow;

describe('workflow authoring engine', () => {
  it('round trips a workflow through a draft and upsert args', () => {
    const draft = draftFromWorkflow({ workflow });
    const args = upsertArgsFromDraft({ draft, workspaceId: workflow.workspaceId, id: workflow.id });
    expect(draft.steps.map((step) => step.name)).toEqual(['Review', 'Publish']);
    expect(args).toMatchObject({
      id: workflow.id,
      name: 'Ship',
      description: 'Prepare release',
      goal: 'Deliver',
      isPreset: true,
      origin: 'custom',
      steps: [
        { id: 'step-1', ordinal: 0, name: 'Review', promptPrefix: 'Review it' },
        { id: 'step-2', ordinal: 1, name: 'Publish', promptPrefix: 'Publish it' },
      ],
    });
  });

  it('creates a draft from a library definition', () => {
    const def = {
      id: 'def-1',
      workspaceId: null,
      role: 'reviewer',
      name: 'Review',
      promptPrefix: 'Review carefully',
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
    } as StepDef;
    expect(draftFromStepDef({ def })).toMatchObject({
      libraryStepId: 'def-1',
      sourceStepId: null,
      name: 'Review',
      prompt: 'Review carefully',
    });
  });

  it('normalizes unknown planner roles', () => {
    const steps = draftFromPlannerSteps({
      steps: [
        { name: 'Known', role: 'reviewer', promptPrefix: 'Review', expectedOutput: 'Notes' },
        { name: 'Unknown', role: 'emperor', promptPrefix: 'Rule', expectedOutput: 'Order' },
      ],
    });
    expect(steps.map((step) => step.role)).toEqual(['reviewer', 'custom']);
  });

  it('clamps effort when the model changes', () => {
    const step = addStep({ steps: [] })[0];
    expect(step).toBeDefined();
    if (step === undefined) {
      return;
    }
    const changed = stepDraftWithModel({
      step: { ...step, effort: 'max' },
      provider: workflow.steps[1]?.providerOverride ?? '',
      model: 'claude-sonnet-4-6',
      recommendedModel: 'claude-opus-4-8',
    });
    expect(changed.provider).toBe('anthropic');
    expect(changed.model).toBe('claude-sonnet-4-6');
    expect(changed.effort).toBe('high');
  });

  it('clamps effort against the recommended model when the model resets to auto', () => {
    const step = addStep({ steps: [] })[0];
    expect(step).toBeDefined();
    if (step === undefined) {
      return;
    }
    const changed = stepDraftWithModel({
      step: { ...step, effort: 'max' },
      provider: '',
      model: '',
      recommendedModel: 'claude-sonnet-4-6',
    });
    expect(changed.model).toBe('');
    expect(changed.effort).toBe('high');
  });

  it('returns workflow and step field errors', () => {
    const empty = { ...draftFromWorkflow({ workflow }), name: '', steps: [] };
    expect(validateDraft({ draft: empty })).toEqual({
      name: 'Name is required',
      steps: 'Add at least one step',
      stepNames: {},
    });
    const step = addStep({ steps: [] })[0];
    expect(step).toBeDefined();
    if (step === undefined) {
      return;
    }
    expect(validateDraft({ draft: { ...empty, name: 'Named', steps: [step] } }).stepNames).toEqual({
      [step.key]: 'Step name is required',
    });
  });

  it('updates step collections immutably', () => {
    const first = addStep({ steps: [] })[0];
    const second = addStep({ steps: [] })[0];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (first === undefined || second === undefined) {
      return;
    }
    const source = [first, second];
    const updated = updateStep({ steps: source, key: first.key, patch: { name: 'First' } });
    const reordered = reorderSteps({ steps: updated, from: 0, to: 2 });
    const removed = removeStep({ steps: reordered, key: first.key });
    expect(source[0]?.name).toBe('');
    expect(updated).not.toBe(source);
    expect(reordered.map((step) => step.key)).toEqual([second.key, first.key]);
    expect(removed).toEqual([second]);
  });
});
