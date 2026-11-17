import { describe, expect, it } from 'vitest';
import type { AutoLedgerEntry } from './ledger';
import { waitingPlanChangeOf } from './waitingPlanChangeOf';

type EntryParams = {
  readonly patch?: Partial<AutoLedgerEntry>;
};

const entryOf = ({ patch = {} }: EntryParams): AutoLedgerEntry => ({
  artifactId: 'plan-1',
  kind: 'plan',
  title: 'Plan for notify-relay',
  revision: 1,
  status: 'active',
  producerAgentId: 'agent-planner',
  producerDelegationId: 'delegation-plan',
  producerRole: 'planner',
  lastAuthor: 'agent',
  lastAsk: null,
  approval: 'needs_approval',
  openReviseDelegationId: null,
  consumerDelegationIds: [],
  contentHash: 'hash',
  updatedAt: 1,
  outline: '',
  ...patch,
});

describe('waitingPlanChangeOf', () => {
  it('names the plan and the version that waits for approval', () => {
    expect(
      waitingPlanChangeOf({ entries: [entryOf({ patch: { revision: 2 } })], level: 'plan' }),
    ).toEqual({ artifactId: 'plan-1', baseRevision: 2, commentIds: [] });
  });

  it('names nothing when two plans wait, so the Lead asks which one', () => {
    const entries = [
      entryOf({ patch: { artifactId: 'plan-old' } }),
      entryOf({ patch: { artifactId: 'plan-new' } }),
    ];
    expect(waitingPlanChangeOf({ entries, level: 'step' })).toBeNull();
  });

  it('names the one plan that waits beside an approved one', () => {
    const entries = [
      entryOf({ patch: { artifactId: 'plan-done', approval: 'approved' } }),
      entryOf({ patch: { artifactId: 'plan-new' } }),
    ];
    expect(waitingPlanChangeOf({ entries, level: 'step' })?.artifactId).toBe('plan-new');
  });

  it.each([
    ['an approved plan', entryOf({ patch: { approval: 'approved' } })],
    [
      'a plan under revision',
      entryOf({ patch: { approval: 'revising', openReviseDelegationId: 'd-2' } }),
    ],
    ['a used plan', entryOf({ patch: { status: 'consumed' } })],
    ['another kind', entryOf({ patch: { kind: 'report' } })],
  ])('names nothing for %s', (_name, entry) => {
    expect(waitingPlanChangeOf({ entries: [entry], level: 'plan' })).toBeNull();
  });

  it('names nothing when the run never stops for a plan', () => {
    expect(waitingPlanChangeOf({ entries: [entryOf({})], level: 'run' })).toBeNull();
  });
});
