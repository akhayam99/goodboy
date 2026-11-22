// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type AgentId } from '@goodboy/types';
import type { ActionCardModel, AutoActionTarget } from './actionCardsOf';
import { NEXT_LIMIT, overviewMovesOf } from './overviewMovesOf';

const TARGET: AutoActionTarget = {
  agentId: brandId<AgentId>({ value: 'agent-lead' }),
  rootAgentId: brandId<AgentId>({ value: 'agent-lead' }),
  role: 'Lead',
  noun: 'Lead',
  kind: 'failed',
  reason: null,
  reasonCode: null,
  mountId: null,
  plan: null,
  canRetry: true,
};

type CardParams = {
  readonly id: string;
  readonly band: 0 | 1 | 2;
};

const cardOf = ({ id, band }: CardParams): ActionCardModel => ({
  id,
  band,
  priority: 0,
  kind: 'failed',
  title: id,
  detail: null,
  mountId: null,
  source: { kind: 'auto', target: TARGET },
  folded: [],
  reason: null,
  evidence: [],
});

describe('overviewMovesOf', () => {
  it('puts every move that waits on you in Needs you and keeps at most three in Next', () => {
    const cards = [
      cardOf({ id: 'ask', band: 0 }),
      cardOf({ id: 'fix', band: 1 }),
      cardOf({ id: 'merge', band: 1 }),
      cardOf({ id: 'push', band: 2 }),
      cardOf({ id: 'clean', band: 2 }),
    ];
    const moves = overviewMovesOf({ cards });
    expect(moves.needsYou.map((card) => card.id)).toEqual(['ask']);
    expect(moves.next.map((card) => card.id)).toEqual(['fix', 'merge', 'push']);
    expect(moves.next).toHaveLength(NEXT_LIMIT);
    expect(moves.rest.map((card) => card.id)).toEqual(['clean']);
  });

  it('shows each move once', () => {
    const cards = [cardOf({ id: 'a', band: 0 }), cardOf({ id: 'b', band: 1 })];
    const moves = overviewMovesOf({ cards });
    const ids = [...moves.needsYou, ...moves.next, ...moves.rest].map((card) => card.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(cards.length);
  });
});
