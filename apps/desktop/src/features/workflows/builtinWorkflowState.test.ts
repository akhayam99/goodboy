import { describe, expect, it } from 'vitest';
import { WORKFLOW_LIBRARY } from '@goodboy/core';
import type { AgentRole, StepId, Workflow, WorkflowId } from '@goodboy/types';
import { builtinWorkflowState, restorableBuiltins } from './builtinWorkflowState';

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

const seededEvery = (): ReadonlyArray<Workflow> =>
  WORKFLOW_LIBRARY.map((libraryEntry): Workflow => {
    const id = `wf_seed_${libraryEntry.slug}_ws-1` as WorkflowId;
    return {
      ...seededWorkflow({ id, name: libraryEntry.name }),
      steps: libraryEntry.steps.map((step, ordinal) => ({
        id: `step-${libraryEntry.slug}-${ordinal}` as StepId,
        workflowId: id,
        role: step.role as AgentRole,
        ordinal,
        name: step.name,
        promptPrefix: step.promptPrefix,
        expectedOutput: step.expectedOutput,
      })),
    };
  });

describe('restorableBuiltins', () => {
  it('offers nothing when every built-in matches the library', () => {
    expect(restorableBuiltins({ workflows: seededEvery() })).toEqual([]);
  });

  it('lists the edited and the deleted built-ins, and skips the unchanged one', () => {
    const [refactor, planAndShip] = seededEvery();
    if (refactor === undefined || planAndShip === undefined) {
      throw new Error('the workflow library has fewer than two entries');
    }
    const drift = restorableBuiltins({
      workflows: [refactor, { ...planAndShip, name: 'Plan and ship ledger-core' }],
    });
    expect(drift.map(({ entry, drift: state }) => [entry.name, state])).toEqual([
      ['Plan and ship', 'edited'],
      ['Fix a bug', 'deleted'],
    ]);
  });

  it('skips a built-in whose name another workflow now holds', () => {
    const [refactor, planAndShip] = seededEvery();
    if (refactor === undefined || planAndShip === undefined) {
      throw new Error('the workflow library has fewer than two entries');
    }
    const own = seededWorkflow({ id: 'wf-own' as WorkflowId, name: 'Fix a bug', origin: 'custom' });
    expect(restorableBuiltins({ workflows: [refactor, planAndShip, own] })).toEqual([]);
  });
});
