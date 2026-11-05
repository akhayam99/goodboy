import { describe, expect, it } from 'vitest';
import { DEFAULT_WORKFLOW_RULES, brandId, type ArtifactId } from '@goodboy/types';
import { aWorkflowRun } from '@goodboy/types/testing';
import { aPlan } from '../../test/planFixtures';
import { aPlanRow, aView } from '../auto/testing/autoViewFixtures';
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

  it('reads auto-approved for a plan Auto approved, and none while Auto waits on it', () => {
    const approvedView = aView({ artifacts: [aPlanRow({ approvalState: 'approved' })] });
    const waitingView = aView({ artifacts: [aPlanRow({ approvalState: 'needs_approval' })] });
    const plan = aPlan({ id: brandId<ArtifactId>({ value: 'artifact-plan' }) });
    expect(planHandoffOf({ plan, run: null, views: [approvedView] })).toBe('auto-approved');
    expect(planHandoffOf({ plan, run: null, views: [waitingView] })).toBe('none');
    expect(
      planHandoffOf({
        plan: aPlan({ id: brandId<ArtifactId>({ value: 'artifact-other' }) }),
        run: null,
        views: [approvedView],
      }),
    ).toBe('none');
    expect(
      planHandoffOf({ plan: { ...plan, consumptionCount: 1 }, run: null, views: [approvedView] }),
    ).toBe('none');
  });

  it('has no gap for a plan that was replaced or deleted', () => {
    expect(planHandoffOf({ plan: aPlan({ status: 'superseded' }), run: approved })).toBe('none');
    expect(planHandoffOf({ plan: aPlan({ status: 'discarded' }), run: approved })).toBe('none');
  });
});
