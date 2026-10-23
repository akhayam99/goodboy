import { describe, expect, it } from 'vitest';
import type { WorkflowAdvanceState } from '../../../workflows/advanceGate';
import { FIXTURE_NOW } from '../../../auto/testing/autoViewFixtures';
import { liveGroupsOf, type LiveRunGroup } from './liveGroupsOf';
import { runStepCardOf } from './runStepCardOf';
import { aNowRun, aNowStepAgent, aNowWorkflow, nowModelOf } from './testing/nowModelOf';

const STEPS = ['Find the layout bug', 'Center the page wrapper', 'Check at three widths'];

type GroupParams = {
  readonly isRunning: boolean;
};

const groupOf = ({ isRunning }: GroupParams): LiveRunGroup => {
  const attached = aNowRun({
    key: 'profile',
    title: 'Center the profile page',
    workflow: aNowWorkflow({ key: 'profile', name: 'Fix a layout', stepNames: STEPS }),
  });
  const agents = [
    aNowStepAgent({ attached, stepIndex: 0, status: 'completed', name: STEPS[0] ?? '' }),
    aNowStepAgent({
      attached,
      stepIndex: 1,
      status: isRunning ? 'running' : 'pending',
      name: STEPS[1] ?? '',
      kind: 'implementer',
    }),
  ];
  const step = attached.workflow.steps[1];
  if (step === undefined) {
    throw new Error('the preset needs a second step');
  }
  const ready: WorkflowAdvanceState = { kind: 'ready', step };
  const [group] = liveGroupsOf({
    model: nowModelOf({
      agents,
      runs: [attached],
      advanceByRunId: isRunning ? new Map() : new Map([[attached.run.id, ready]]),
    }),
    agents,
    now: FIXTURE_NOW,
  });
  if (group?.kind !== 'run') {
    throw new Error('the layout run must be a run group');
  }
  return group;
};

describe('runStepCardOf', () => {
  it('names the running step, its workflow, role, model, time in and what comes next', () => {
    const card = runStepCardOf({
      group: groupOf({ isRunning: true }),
      model: 'Sonnet 5.5 · Medium',
      time: '9m',
    });

    expect(card.title).toBe('Center the page wrapper');
    expect(card.sub).toBe('Step 2 of 3');
    expect(card.state).toEqual({ tone: 'info', words: 'Implementer working', isRunning: true });
    expect(card.facts).toEqual([
      { label: 'Workflow', value: 'Preset', note: 'Center the profile page' },
      { label: 'Role', value: 'Implementer' },
      { label: 'Model', value: 'Sonnet 5.5 · Medium' },
      { label: 'Time in', value: '9m' },
      { label: 'Next', value: 'Step 3, Check at three widths' },
    ]);
    expect(card.footnote).toBe('Click to open the step.');
  });

  it('says a step at the gate waits for your go and what the button starts, with no model', () => {
    const card = runStepCardOf({
      group: groupOf({ isRunning: false }),
      model: 'Sonnet 5.5 · Medium',
      time: null,
    });

    expect(card.state).toEqual({ tone: 'warning', words: 'Waits for your go' });
    expect(card.facts.map((fact) => fact.label)).toEqual(['Workflow', 'Role', 'Next']);
    expect(card.footnote).toBe('Start step 2 starts the implementer.');
  });
});
