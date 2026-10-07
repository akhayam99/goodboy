import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WORKFLOW_RULES,
  type ArtifactComment,
  type ArtifactId,
  type IsoDateTime,
  type SessionId,
} from '@goodboy/types';
import { aWorkflowRun } from '@goodboy/types/testing';
import { aPlan } from '../../test/planFixtures';
import { planPrimaryOf } from './planPrimaryOf';

const AT = '2026-10-05T10:00:00.000Z' as IsoDateTime;

const aDraft = (id: string): ArtifactComment => ({
  id,
  sessionId: 'session-harborline' as SessionId,
  artifactId: 'plan-retries' as ArtifactId,
  revision: 1,
  anchor: { kind: 'quote', order: 0, text: 'backoff', blockText: 'Add backoff' },
  body: 'Cap the retries at three',
  status: 'draft',
  sentTurnId: null,
  createdAt: AT,
  updatedAt: AT,
});

const heldRun = aWorkflowRun({
  orchestrationStop: { kind: 'plan-approval', message: 'The plan is ready.' },
  rulesSnapshot: { ...DEFAULT_WORKFLOW_RULES, autonomy: 'plan' },
});

const plannerRun = aWorkflowRun({ rulesSnapshot: DEFAULT_WORKFLOW_RULES });

const revising = { kind: 'revising', nextRevision: 2 } as const;

describe('planPrimaryOf', () => {
  it('approves the plan a run is held for', () => {
    expect(planPrimaryOf({ plan: aPlan(), run: heldRun, drafts: [] })).toEqual({
      kind: 'approve',
      label: 'Approve',
      reason: null,
      isSecondary: false,
    });
  });

  it('approves a run plan whose next step consumes it, even when the run is not held', () => {
    expect(planPrimaryOf({ plan: aPlan(), run: plannerRun, drafts: [] }).kind).toBe('approve');
  });

  it('runs a session plan that belongs to no run', () => {
    expect(planPrimaryOf({ plan: aPlan(), run: null, drafts: [] })).toEqual({
      kind: 'run',
      label: 'Run plan',
      reason: null,
      isSecondary: false,
    });
  });

  it('runs a plan whose run was discarded, never approves it', () => {
    const discarded = aWorkflowRun({ ...heldRun, discardedAt: AT });

    expect(planPrimaryOf({ plan: aPlan(), run: discarded, drafts: [] })).toMatchObject({
      kind: 'run',
      label: 'Run plan',
    });
  });

  it('disables the primary with its reason while the planner revises, held or not', () => {
    expect(planPrimaryOf({ plan: aPlan(), run: heldRun, drafts: [], revising })).toEqual({
      kind: 'disabled',
      label: 'Approve',
      reason: 'The planner is revising this plan',
      isSecondary: false,
    });
    expect(planPrimaryOf({ plan: aPlan(), run: null, drafts: [], revising })).toMatchObject({
      kind: 'disabled',
      label: 'Run plan',
    });
  });

  it('offers nothing once the plan is approved and the hold is lifted', () => {
    const approved = aWorkflowRun({
      rulesSnapshot: { ...DEFAULT_WORKFLOW_RULES, autonomy: 'plan', planApproved: true },
    });

    expect(planPrimaryOf({ plan: aPlan(), run: approved, drafts: [] }).kind).toBe('none');
  });

  it('still approves a plan that is held even if the copy of the rules says approved', () => {
    const halfWritten = aWorkflowRun({
      ...heldRun,
      rulesSnapshot: { ...DEFAULT_WORKFLOW_RULES, autonomy: 'plan', planApproved: true },
    });

    expect(planPrimaryOf({ plan: aPlan(), run: halfWritten, drafts: [] }).kind).toBe('approve');
  });

  it('offers nothing for a plan that ran, was replaced or was deleted', () => {
    expect(planPrimaryOf({ plan: aPlan({ status: 'consumed' }), run: null, drafts: [] }).kind).toBe(
      'none',
    );
    expect(
      planPrimaryOf({ plan: aPlan({ consumptionCount: 1 }), run: heldRun, drafts: [] }).kind,
    ).toBe('none');
    expect(
      planPrimaryOf({ plan: aPlan({ status: 'superseded' }), run: heldRun, drafts: [] }).kind,
    ).toBe('none');
    expect(
      planPrimaryOf({ plan: aPlan({ status: 'discarded' }), run: null, drafts: [] }).kind,
    ).toBe('none');
  });

  it('offers nothing while the plan is running', () => {
    expect(planPrimaryOf({ plan: aPlan(), run: null, drafts: [], isRunning: true }).kind).toBe(
      'none',
    );
  });

  it('keeps the kind and turns it secondary when comments are unsent', () => {
    const drafts = [aDraft('c-1'), aDraft('c-2')];

    expect(planPrimaryOf({ plan: aPlan(), run: heldRun, drafts })).toEqual({
      kind: 'approve',
      label: 'Approve',
      reason: null,
      isSecondary: true,
    });
    expect(planPrimaryOf({ plan: aPlan(), run: null, drafts })).toEqual({
      kind: 'run',
      label: 'Run plan',
      reason: null,
      isSecondary: true,
    });
  });

  it('has nothing to demote when there is no primary', () => {
    const drafts = [aDraft('c-1')];

    expect(planPrimaryOf({ plan: aPlan({ status: 'consumed' }), run: null, drafts })).toEqual({
      kind: 'none',
      label: null,
      reason: null,
      isSecondary: false,
    });
  });

  it('turns Approve off with the question reason while the planner has an open question', () => {
    expect(
      planPrimaryOf({ plan: aPlan(), run: heldRun, drafts: [], plannerQuestionCount: 1 }),
    ).toEqual({
      kind: 'disabled',
      label: 'Approve',
      reason: 'The planner asked a question. Answer it first.',
      isSecondary: false,
    });
  });

  it('turns Run plan off the same way for a session plan', () => {
    expect(
      planPrimaryOf({ plan: aPlan(), run: null, drafts: [], plannerQuestionCount: 2 }),
    ).toMatchObject({ kind: 'disabled', label: 'Run plan' });
  });

  it('keeps the revising reason when the planner both revises and asks', () => {
    expect(
      planPrimaryOf({
        plan: aPlan(),
        run: heldRun,
        drafts: [],
        revising,
        plannerQuestionCount: 1,
      }).reason,
    ).toBe('The planner is revising this plan');
  });

  it('shows nothing for a plan that already ran, question or not', () => {
    expect(
      planPrimaryOf({
        plan: aPlan({ status: 'consumed', consumptionCount: 1 }),
        run: heldRun,
        drafts: [],
        plannerQuestionCount: 1,
      }).kind,
    ).toBe('none');
  });
});
