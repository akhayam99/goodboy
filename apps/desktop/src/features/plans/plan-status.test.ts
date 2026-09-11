import { describe, expect, it } from 'vitest';
import type { PlanStatus } from '@goodboy/types';
import { PLAN_STATUS_PRESENTATION, describePlanStatus } from './plan-status';

const STATUSES = Object.keys(PLAN_STATUS_PRESENTATION) as ReadonlyArray<PlanStatus>;

describe('describePlanStatus', () => {
  it('stops a healthy active plan from wearing the attention colour', () => {
    expect(describePlanStatus({ status: 'active' }).tone).toBe('info');
  });

  it('raises attention only when the plan is blocked on an answer', () => {
    const blocked = describePlanStatus({ status: 'active', openQuestionCount: 2 });

    expect(blocked.tone).toBe('warning');
    expect(blocked.label).toBe('needs you');
    expect(blocked.reason).toContain('open questions');
  });

  it('leaves a settled plan alone even with questions open elsewhere', () => {
    expect(describePlanStatus({ status: 'consumed', openQuestionCount: 3 })).toEqual(
      PLAN_STATUS_PRESENTATION.consumed,
    );
  });

  it('separates a plan that ran from one that was dropped', () => {
    const consumed = describePlanStatus({ status: 'consumed' });
    const discarded = describePlanStatus({ status: 'discarded' });

    expect(consumed.tone).not.toBe(discarded.tone);
    expect(consumed.icon).not.toBe(discarded.icon);
    expect(consumed.reason).not.toBe(discarded.reason);
  });

  it('gives every status a label and a reason', () => {
    for (const status of STATUSES) {
      const presentation = describePlanStatus({ status });
      expect(presentation.label.length, status).toBeGreaterThan(0);
      expect(presentation.reason.length, status).toBeGreaterThan(0);
    }
  });
});
