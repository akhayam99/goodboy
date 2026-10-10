import { describe, expect, it } from 'vitest';
import { DEFAULT_WORKFLOW_RULES } from '@goodboy/types';
import { aWorkflowRun } from '@goodboy/types/testing';
import { aPlan } from '../../test/planFixtures';
import { planHandoffOf } from './planHandoffOf';

const approved = aWorkflowRun({
  rulesSnapshot: { ...DEFAULT_WORKFLOW_RULES, autonomy: 'plan', planApproved: true },
});

const held = aWorkflowRun({
  orchestrationStop: { kind: 'plan-approval', message: 'The plan is ready.' },
  rulesSnapshot: { ...DEFAULT_WORKFLOW_RULES, autonomy: 'plan' },
});

describe('planHandoffOf', () => {
  it('names the gap between Approve and the step that consumes the plan', () => {
    expect(planHandoffOf({ plan: aPlan(), run: approved })).toBe('approved-waiting');
  });

  it('ends the gap once a step consumed the plan', () => {
    expect(planHandoffOf({ plan: aPlan({ consumptionCount: 1 }), run: approved })).toBe('none');
    expect(planHandoffOf({ plan: aPlan({ status: 'consumed' }), run: approved })).toBe('none');
  });

  it('has no gap while the run still holds the plan, whatever the rules copy says', () => {
    expect(planHandoffOf({ plan: aPlan(), run: held })).toBe('none');
    const halfWritten = aWorkflowRun({
      ...held,
      rulesSnapshot: { ...DEFAULT_WORKFLOW_RULES, autonomy: 'plan', planApproved: true },
    });
    expect(planHandoffOf({ plan: aPlan(), run: halfWritten })).toBe('none');
  });

  it('has no gap while the run is stopped for any other reason', () => {
    const kinds = [
      'failure',
      'budget',
      'questions',
      'paused',
      'operator',
      'closed',
      'needs-approval',
    ] as const;
    for (const kind of kinds) {
      const stopped = aWorkflowRun({
        ...approved,
        orchestrationStop: { kind, message: 'Stopped.' },
      });
      expect(planHandoffOf({ plan: aPlan(), run: stopped })).toBe('none');
    }
  });

  it('has no gap for a plan no run owns or a run that was never approved', () => {
    expect(planHandoffOf({ plan: aPlan(), run: null })).toBe('none');
    expect(
      planHandoffOf({
        plan: aPlan(),
        run: aWorkflowRun({ rulesSnapshot: DEFAULT_WORKFLOW_RULES }),
      }),
    ).toBe('none');
  });

  it('has no gap for a plan that was replaced or deleted', () => {
    expect(planHandoffOf({ plan: aPlan({ status: 'superseded' }), run: approved })).toBe('none');
    expect(planHandoffOf({ plan: aPlan({ status: 'discarded' }), run: approved })).toBe('none');
  });
});
