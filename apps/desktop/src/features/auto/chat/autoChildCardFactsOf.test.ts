import { describe, expect, it } from 'vitest';
import type { AutoDelegation } from '@goodboy/db';
import { brandId, type IsoDateTime, type ProviderRunId } from '@goodboy/types';
import { autoChildLive } from '../../live-state/adapters/autoChildLive';
import { aDelegation } from '../testing/autoViewFixtures';
import { autoChildCardFactsOf } from './autoChildCardFactsOf';
import { delegationCardOf } from './delegationCardOf';

const STARTED = brandId<IsoDateTime>({ value: '2026-10-13T12:00:00.000Z' });
const AGENT = { status: 'running' } as const;

type FactsParams = {
  readonly delegation: AutoDelegation;
  readonly isTurnRunning?: boolean;
};

const factsOf = ({ delegation, isTurnRunning = false }: FactsParams) =>
  autoChildCardFactsOf({
    card: delegationCardOf({ delegation, childAgent: null }),
    live: autoChildLive({
      delegation,
      turn: isTurnRunning
        ? { kind: 'running', runId: brandId<ProviderRunId>({ value: 'run-1' }), startedAt: STARTED }
        : null,
      agent: AGENT,
      lastTool: { name: 'Read', command: null, path: 'src/ledger.ts' },
      project: null,
    }),
  });

describe('autoChildCardFactsOf', () => {
  it('shows the real last tool of a running child', () => {
    const facts = factsOf({
      delegation: aDelegation({ key: 'impl', role: 'implementer', state: 'running' }),
      isTurnRunning: true,
    });

    expect(facts).toEqual({
      word: 'Running',
      tone: 'info',
      activity: 'Reading ledger.ts',
    });
  });

  it('shows a queued child with no activity', () => {
    const facts = factsOf({
      delegation: aDelegation({ key: 'impl', role: 'implementer', state: 'accepted' }),
    });

    expect(facts).toMatchObject({
      word: 'Queued',
      tone: 'neutral',
      activity: null,
    });
  });

  it('paints a child that needs you in the waiting tone', () => {
    const facts = factsOf({
      delegation: aDelegation({ key: 'planner', role: 'planner', state: 'awaiting_confirm' }),
    });

    expect(facts).toMatchObject({
      word: 'Needs you',
      tone: 'warning',
      activity: 'Waiting for your OK',
    });
  });

  it('says Stopping while the child is stopping', () => {
    const facts = factsOf({
      delegation: {
        ...aDelegation({ key: 'impl', role: 'implementer', state: 'running' }),
        isStopping: true,
      },
      isTurnRunning: true,
    });

    expect(facts.word).toBe('Stopping');
  });

  it('has no activity once the delegation settled', () => {
    const facts = factsOf({
      delegation: aDelegation({
        key: 'impl',
        role: 'implementer',
        state: 'settled',
        outcome: 'completed',
      }),
    });

    expect(facts.activity).toBeNull();
  });
});
