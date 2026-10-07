import { describe, expect, it } from 'vitest';
import type { PlanPrimary } from '../../../plans/planPrimaryOf';
import { aPlanDraft } from '../../../../test/planDrawerFixtures';
import { planDrawerReasonOf } from './planDrawerReason';

const APPROVE: PlanPrimary = {
  kind: 'approve',
  label: 'Approve',
  reason: null,
  isSecondary: false,
};

const REVISING: PlanPrimary = {
  kind: 'disabled',
  label: 'Approve',
  reason: 'The planner is revising this plan',
  isSecondary: false,
};

const SPLIT = 'This plan runs as 3 parallel parts. Ask the planner to change it.';

describe('planDrawerReasonOf', () => {
  it('prints the reason the primary is off', () => {
    expect(
      planDrawerReasonOf({ isEditing: false, primary: REVISING, drafts: [], editBlock: null }),
    ).toBe('The planner is revising this plan');
  });

  it('prints why Edit is off when the plan is split into parts', () => {
    expect(
      planDrawerReasonOf({ isEditing: false, primary: APPROVE, drafts: [], editBlock: SPLIT }),
    ).toBe(SPLIT);
  });

  it('leaves the unsent comments to the comment bar', () => {
    expect(
      planDrawerReasonOf({
        isEditing: false,
        primary: APPROVE,
        drafts: [aPlanDraft()],
        editBlock: 'Send or discard your 1 comment first',
      }),
    ).toBeNull();
  });

  it('prints nothing while the plan is being edited', () => {
    expect(
      planDrawerReasonOf({ isEditing: true, primary: REVISING, drafts: [], editBlock: SPLIT }),
    ).toBeNull();
  });
});
