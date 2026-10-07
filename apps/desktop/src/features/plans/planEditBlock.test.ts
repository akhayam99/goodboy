import { describe, expect, it } from 'vitest';
import type {
  ArtifactComment,
  ArtifactId,
  ImplementationCluster,
  IsoDateTime,
  SessionId,
} from '@goodboy/types';
import { aPlan } from '../../test/planFixtures';
import { planEditBlockOf } from './planEditBlock';

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

const parts = (count: number): ReadonlyArray<ImplementationCluster> =>
  Array.from({ length: count }, (_, index) => ({
    title: `Part ${index + 1} in payments-api`,
    instructions: 'Add backoff',
  }));

describe('planEditBlockOf', () => {
  it('blocks while the planner revises, before anything else', () => {
    const block = planEditBlockOf({
      plan: aPlan({ clusters: parts(3) }),
      drafts: [aDraft('c-1')],
      isRevising: true,
    });

    expect(block).toBe('The planner is revising this plan');
  });

  it('asks to send or discard the unsent comments first', () => {
    expect(planEditBlockOf({ plan: aPlan(), drafts: [aDraft('c-1')], isRevising: false })).toBe(
      'Send or discard your 1 comment first',
    );
    expect(
      planEditBlockOf({
        plan: aPlan(),
        drafts: [aDraft('c-1'), aDraft('c-2'), aDraft('c-3')],
        isRevising: false,
      }),
    ).toBe('Send or discard your 3 comments first');
  });

  it('blocks a plan that splits into parallel parts, naming how many', () => {
    expect(
      planEditBlockOf({ plan: aPlan({ clusters: parts(2) }), drafts: [], isRevising: false }),
    ).toBe('This plan runs as 2 parallel parts. Ask the planner to change it.');
    expect(
      planEditBlockOf({ plan: aPlan({ clusters: parts(3) }), drafts: [], isRevising: false }),
    ).toBe('This plan runs as 3 parallel parts. Ask the planner to change it.');
  });

  it('lets a single plan be edited', () => {
    expect(planEditBlockOf({ plan: aPlan(), drafts: [], isRevising: false })).toBeNull();
    expect(
      planEditBlockOf({ plan: aPlan({ clusters: parts(1) }), drafts: [], isRevising: false }),
    ).toBeNull();
  });
});
