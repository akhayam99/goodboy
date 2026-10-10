import { describe, expect, it } from 'vitest';
import type { PlanPrimary } from '../../../plans/planPrimaryOf';
import { NO_PLAN_STATE_INPUTS } from '../../../plans/planStateInputs';
import { artifactStateOf } from '../../artifactStateOf';
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

const NONE: PlanPrimary = { kind: 'none', label: null, reason: null, isSecondary: false };

const SPLIT = 'This plan runs as 3 parallel parts. Ask the planner to change it.';

describe('planDrawerReasonOf', () => {
  it('prints the reason the primary is off', () => {
    expect(
      planDrawerReasonOf({
        isEditing: false,
        primary: REVISING,
        state: null,
        drafts: [],
        editBlock: null,
      }),
    ).toBe('The planner is revising this plan');
  });

  it('prints why Edit is off when the plan is split into parts', () => {
    expect(
      planDrawerReasonOf({
        isEditing: false,
        primary: APPROVE,
        state: null,
        drafts: [],
        editBlock: SPLIT,
      }),
    ).toBe(SPLIT);
  });

  it('leaves the unsent comments to the comment bar', () => {
    expect(
      planDrawerReasonOf({
        isEditing: false,
        primary: APPROVE,
        state: null,
        drafts: [aPlanDraft()],
        editBlock: 'Send or discard your 1 comment first',
      }),
    ).toBeNull();
  });

  it('prints nothing while the plan is being edited', () => {
    expect(
      planDrawerReasonOf({
        isEditing: true,
        primary: REVISING,
        state: null,
        drafts: [],
        editBlock: SPLIT,
      }),
    ).toBeNull();
  });

  it('prints why the run offers nothing while it chooses the next step', () => {
    const state = artifactStateOf({
      ...NO_PLAN_STATE_INPUTS,
      kind: 'plan',
      status: 'active',
      isNew: false,
      openQuestionCount: 0,
      handoff: 'approved-waiting',
    });
    expect(
      planDrawerReasonOf({ isEditing: false, primary: NONE, state, drafts: [], editBlock: null }),
    ).toBe('The run is choosing the next step');
  });
});
