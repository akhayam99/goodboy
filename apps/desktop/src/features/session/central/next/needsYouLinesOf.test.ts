import { describe, expect, it } from 'vitest';
import { brandId, type AgentId } from '@goodboy/types';
import type { NeedsYouOwner } from '../../timeline/needsYou';
import { actionCardsOf, type AutoActionTarget } from './actionCardsOf';
import { needsYouLinesOf } from './needsYouLinesOf';

const NOW = Date.parse('2026-10-18T18:30:00.000Z');

const targetOf = (overrides: Partial<AutoActionTarget>): AutoActionTarget => ({
  agentId: brandId<AgentId>({ value: 'agent-planner' }),
  rootAgentId: brandId<AgentId>({ value: 'agent-lead' }),
  role: 'Planner',
  kind: 'failed',
  noun: 'Planner',
  reason: null,
  reasonCode: null,
  mountId: null,
  plan: null,
  canRetry: true,
  ...overrides,
});

const ownerOf = (overrides: Partial<NeedsYouOwner>): NeedsYouOwner => ({
  id: 'owner-1',
  kind: 'question',
  text: 'Cap per day or per payout?',
  where: 'Build step 4 waits on it',
  at: '2026-10-18T10:30:00.000Z',
  item: null,
  question: null,
  questionIds: [],
  prNumber: null,
  owed: null,
  mountId: null,
  ...overrides,
});

const [stuck] = actionCardsOf({ owners: [], suggestions: [], autoTargets: [targetOf({})] });

describe('needsYouLinesOf', () => {
  it.each(['neverStarted', 'failed', 'timedOut'] as const)(
    'says what happened as the title and who and where as the meta for a %s Lead',
    (kind) => {
      const [card] = actionCardsOf({
        owners: [],
        suggestions: [],
        autoTargets: [targetOf({ kind })],
      });
      if (card === undefined) {
        throw new Error('no card');
      }

      const lines = needsYouLinesOf({ card, project: 'payments-api', now: NOW });

      expect(lines.title).toMatch(/^The planner /);
      expect(lines.meta).toBe('Lead · payments-api');
    },
  );

  it('keeps the title of a plan to approve and a Lead that could not reply', () => {
    const [blocked] = actionCardsOf({
      owners: [],
      suggestions: [],
      autoTargets: [targetOf({ kind: 'blocked', reason: 'The provider refused.' })],
    });
    if (blocked === undefined) {
      throw new Error('no card');
    }

    const lines = needsYouLinesOf({ card: blocked, project: 'ledger-core', now: NOW });

    expect(lines.title).toBe("Lead couldn't reply");
    expect(lines.meta).toBe('Lead · The provider refused. · ledger-core');
  });

  it.each(['question', 'agent', 'run', 'fixRun', 'rebase'] as const)(
    'shows a %s owner by its text, where it waits and how long ago',
    (kind) => {
      const [card] = actionCardsOf({
        owners: [ownerOf({ kind })],
        suggestions: [],
        autoTargets: [],
      });
      if (card === undefined) {
        throw new Error('no card');
      }

      const lines = needsYouLinesOf({ card, project: 'payments-api', now: NOW });

      expect(lines.title).toBe('Cap per day or per payout?');
      expect(lines.meta).toBe(
        `${kind === 'question' ? 'Question · ' : ''}Build step 4 waits on it · payments-api · 8h ago`,
      );
    },
  );

  it('drops a fact it does not have instead of leaving a gap', () => {
    if (stuck === undefined) {
      throw new Error('no card');
    }

    expect(needsYouLinesOf({ card: stuck, project: null, now: NOW }).meta).toBe('Lead');
  });
});
