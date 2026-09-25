import { describe, expect, it } from 'vitest';
import { WORKFLOW_LIBRARY } from '@goodboy/core';
import type { Workflow } from '@goodboy/types';
import { builtinWorkflowState } from './builtinWorkflowState';

const entry = WORKFLOW_LIBRARY[0];

const seededWorkflow = (overrides: Partial<Workflow> = {}): Workflow => {
  if (entry === undefined) {
    throw new Error('the workflow library is empty');
  }
  return {
    id: `wf_seed_${entry.slug}_ws-1`,
    workspaceId: 'ws-1',
    name: entry.name,
    description: entry.description,
    origin: 'library',
    isPreset: true,
    steps: entry.steps.map((step, ordinal) => ({
      id: `step-${ordinal}`,
      role: step.role,
      ordinal,
      name: step.name,
      promptPrefix: step.promptPrefix,
      expectedOutput: step.expectedOutput,
    })),
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  } as Workflow;
};

describe('builtinWorkflowState', () => {
  it('reads a seeded workflow that still matches its library entry as built in', () => {
    expect(builtinWorkflowState({ workflow: seededWorkflow() })).toBe('builtin');
  });

  it('reads a renamed or rewritten built-in as edited', () => {
    const workflow = seededWorkflow();
    const [first, ...rest] = workflow.steps;
    if (first === undefined) {
      throw new Error('the seeded workflow has no steps');
    }
    expect(builtinWorkflowState({ workflow: { ...workflow, name: 'Refactor ledger-core' } })).toBe(
      'edited',
    );
    expect(
      builtinWorkflowState({
        workflow: { ...workflow, steps: [{ ...first, promptPrefix: 'Map it.' }, ...rest] },
      }),
    ).toBe('edited');
    expect(builtinWorkflowState({ workflow: { ...workflow, steps: rest } })).toBe('edited');
  });

  it('reads any workflow the user made as custom', () => {
    expect(builtinWorkflowState({ workflow: seededWorkflow({ origin: 'custom' }) })).toBe('custom');
  });
});
