// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type Step, type StepId, type WorkflowId } from '@goodboy/types';
import { aWorkflowRun } from '@goodboy/types/testing';
import { decisionEntries } from './decisionEntries';

const WORKFLOW_ID = brandId<WorkflowId>({ value: 'workflow-recap' });

type StepParams = {
  readonly ordinal: number;
  readonly name: string;
  readonly orchestratorReason?: string;
};

const stepOf = ({ ordinal, name, orchestratorReason }: StepParams): Step => ({
  id: brandId<StepId>({ value: `step-recap-${ordinal}` }),
  workflowId: WORKFLOW_ID,
  ordinal,
  name,
  promptPrefix: `${name} the retry changes in payments-api`,
  ...(orchestratorReason === undefined ? {} : { orchestratorReason }),
});

describe('run recap: the closing decision and the step reasons', () => {
  it('labels a finished run with its reason', () => {
    const run = aWorkflowRun({
      orchestrationOutcome: 'done',
      orchestrationReason: ' All required tests pass. ',
    });

    expect(decisionEntries({ run, steps: [] }).closing).toEqual({
      outcome: 'done',
      label: 'Run complete',
      reason: 'All required tests pass.',
    });
  });

  it('labels a stopped run as needing a human call', () => {
    const run = aWorkflowRun({
      orchestrationOutcome: 'blocked',
      orchestrationReason: 'Two steps disagree about the retry limit.',
    });

    expect(decisionEntries({ run, steps: [] }).closing?.label).toBe('Stopped, needs a human call');
  });

  it('shows no closing line while the run has no outcome or no reason', () => {
    expect(decisionEntries({ run: aWorkflowRun(), steps: [] }).closing).toBeNull();
    expect(
      decisionEntries({
        run: aWorkflowRun({ orchestrationOutcome: 'done', orchestrationReason: '   ' }),
        steps: [],
      }).closing,
    ).toBeNull();
  });

  it('lists the step reasons newest first and drops steps without one', () => {
    const steps = [
      stepOf({ ordinal: 0, name: 'Review', orchestratorReason: 'Read the change first.' }),
      stepOf({ ordinal: 1, name: 'Implement' }),
      stepOf({ ordinal: 2, name: 'Test', orchestratorReason: 'Prove the retry limit.' }),
    ];

    expect(
      decisionEntries({ run: aWorkflowRun(), steps }).decisions.map((entry) => entry.title),
    ).toEqual(['Test', 'Review']);
  });
});
