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
  it('shows the real last tool, the start time and Stop for a running child', () => {
    const facts = factsOf({
      delegation: aDelegation({ key: 'impl', role: 'implementer', state: 'running' }),
      isTurnRunning: true,
    });

    expect(facts).toEqual({
      word: 'Running',
      tone: 'info',
      startedAt: STARTED,
      activity: 'Reading ledger.ts',
      canStop: true,
    });
  });

  it('shows a queued child with no clock and no activity, still stoppable', () => {
    const facts = factsOf({
      delegation: aDelegation({ key: 'impl', role: 'implementer', state: 'accepted' }),
    });

    expect(facts).toMatchObject({
      word: 'Queued',
      tone: 'neutral',
      startedAt: null,
      activity: null,
    });
    expect(facts.canStop).toBe(true);
  });

  it('paints a child that needs you in the waiting tone, with no Stop', () => {
    const facts = factsOf({
      delegation: aDelegation({ key: 'planner', role: 'planner', state: 'awaiting_confirm' }),
    });

    expect(facts).toMatchObject({
      word: 'Needs you',
      tone: 'warning',
      activity: 'Waiting for your OK',
    });
    expect(facts.canStop).toBe(false);
  });

  it('takes Stop away while the child is stopping', () => {
    const facts = factsOf({
      delegation: {
        ...aDelegation({ key: 'impl', role: 'implementer', state: 'running' }),
        isStopping: true,
      },
      isTurnRunning: true,
    });

    expect(facts.word).toBe('Stopping');
    expect(facts.canStop).toBe(false);
  });

  it('offers no Stop once the delegation settled', () => {
    const facts = factsOf({
      delegation: aDelegation({
        key: 'impl',
        role: 'implementer',
        state: 'settled',
        outcome: 'completed',
      }),
    });

    expect(facts.canStop).toBe(false);
    expect(facts.activity).toBeNull();
  });
});
