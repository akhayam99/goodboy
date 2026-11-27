import { describe, expect, it } from 'vitest';
import { brandId, type AgentId, type SessionAttentionReason } from '@goodboy/types';
import type { NeedsYouOwner } from '../../timeline/needsYou';
import { actionCardsOf, type AutoActionTarget } from './actionCardsOf';
import { cardsOnBoardOf } from './cardsOnBoardOf';

const LEAD_BLOCKED: AutoActionTarget = {
  agentId: brandId<AgentId>({ value: 'agent-auto' }),
  rootAgentId: brandId<AgentId>({ value: 'agent-auto' }),
  role: 'Lead',
  kind: 'blocked',
  noun: 'Lead',
  reason: null,
  reasonCode: null,
  mountId: null,
  plan: null,
  canRetry: false,
};

const LEAD_PLAN: AutoActionTarget = { ...LEAD_BLOCKED, kind: 'approve' };

const QUESTION: NeedsYouOwner = {
  id: 'question-cap',
  kind: 'question',
  text: 'Cap per day or per payout?',
  where: null,
  at: '2026-10-18T10:30:00.000Z',
  item: null,
  question: null,
  questionIds: [],
  prNumber: null,
  owed: null,
  mountId: null,
};

const cardsOf = () =>
  actionCardsOf({ owners: [QUESTION], suggestions: [], autoTargets: [LEAD_BLOCKED, LEAD_PLAN] });

const kindsOf = (reasons: ReadonlyArray<SessionAttentionReason>) =>
  cardsOnBoardOf({ cards: cardsOf(), reasons })
    .map((card) => card.kind)
    .sort();

describe('cardsOnBoardOf', () => {
  it('keeps a failure card while the board says the session failed', () => {
    expect(kindsOf(['agent-error'])).toEqual(['approve', 'blocked', 'question']);
  });

  it('keeps a stuck Lead card while the board says the Lead needs you', () => {
    expect(kindsOf(['auto-needs-you'])).toEqual(['approve', 'blocked', 'question']);
  });

  it('drops a failure card the board no longer holds, and keeps the question and the plan', () => {
    expect(kindsOf([])).toEqual(['approve', 'question']);
    expect(kindsOf(['open-question'])).toEqual(['approve', 'question']);
  });
});
