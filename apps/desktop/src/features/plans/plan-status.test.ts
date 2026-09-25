import { describe, expect, it } from 'vitest';
import type { PlanStatus } from '@goodboy/types';
import { PLAN_STATUS_PRESENTATION, describePlanStatus } from './plan-status';

const STATUSES = Object.keys(PLAN_STATUS_PRESENTATION) as ReadonlyArray<PlanStatus>;

describe('describePlanStatus', () => {
  it('asks for the next click on a plan nobody ran yet, never the running blue', () => {
    const ready = describePlanStatus({ status: 'active' });
    expect(ready.label).toBe('Ready to run');
    expect(ready.tone).toBe('warning');
  });

  it('says a plan ran with the success tone, never the merged purple of pull requests', () => {
    const ran = describePlanStatus({ status: 'consumed' });
    expect(ran.label).toBe('Ran');
    expect(ran.tone).toBe('success');
  });

  it('raises attention when the plan is blocked on an answer', () => {
    const blocked = describePlanStatus({ status: 'active', openQuestionCount: 2 });
    expect(blocked.tone).toBe('warning');
    expect(blocked.label).toBe('Needs you');
    expect(blocked.reason).toContain('open questions');
  });

  it('leaves a settled plan alone even with questions open elsewhere', () => {
    expect(describePlanStatus({ status: 'consumed', openQuestionCount: 3 })).toEqual(
      PLAN_STATUS_PRESENTATION.consumed,
    );
  });

  it('keeps replaced and discarded plans neutral', () => {
    expect(describePlanStatus({ status: 'superseded' }).tone).toBe('neutral');
    expect(describePlanStatus({ status: 'discarded' }).tone).toBe('neutral');
  });

  it('uses no borrowed tone on any status', () => {
    for (const status of STATUSES) {
      const presentation = describePlanStatus({ status });
      expect(['info', 'merged', 'primary', 'danger']).not.toContain(presentation.tone);
      expect(presentation.reason.length, status).toBeGreaterThan(0);
    }
  });
});
