// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type AgentId } from '@goodboy/types';
import type { ActionCardModel, AutoActionTarget } from '../next/actionCardsOf';
import { cardRowIdOf } from './cardRowIdOf';

const LOOSE = 'loose';

const TARGET: AutoActionTarget = {
  agentId: brandId<AgentId>({ value: 'agent-fixer' }),
  rootAgentId: brandId<AgentId>({ value: 'agent-auto' }),
  role: 'Fixer',
  kind: 'neverStarted',
  noun: 'Fixer',
  reason: null,
  reasonCode: null,
  mountId: null,
  plan: null,
  canRetry: true,
};

type CardParams = {
  readonly kind: ActionCardModel['kind'];
  readonly mountId: string | null;
};

const cardOf = ({ kind, mountId }: CardParams): ActionCardModel => ({
  id: `card:${kind}`,
  band: 1,
  priority: 0,
  kind,
  title: 'Rebase app-web',
  detail: null,
  mountId,
  source: { kind: 'auto', target: TARGET },
  folded: [],
});

const ROW_IDS = new Set(['mount-a', 'no-branch']);

describe('cardRowIdOf', () => {
  it('puts a card on the row of its branch', () => {
    expect(
      cardRowIdOf({
        card: cardOf({ kind: 'push-branch', mountId: 'mount-a' }),
        rowIds: ROW_IDS,
        looseRowId: LOOSE,
      }),
    ).toBe('mount-a');
  });

  it.each(['rebase-project', 'rebase', 'push-branch', 'open-pr', 'merge-pr'] as const)(
    'never gives the not-on-a-branch row the branch verb %s',
    (kind) => {
      expect(
        cardRowIdOf({ card: cardOf({ kind, mountId: null }), rowIds: ROW_IDS, looseRowId: LOOSE }),
      ).toBe(LOOSE);
    },
  );

  it('keeps a question with no branch on the not-on-a-branch row', () => {
    expect(
      cardRowIdOf({
        card: cardOf({ kind: 'answer-questions', mountId: null }),
        rowIds: ROW_IDS,
        looseRowId: LOOSE,
      }),
    ).toBe('no-branch');
  });

  it('falls back to the loose list for a branch the board does not show', () => {
    expect(
      cardRowIdOf({
        card: cardOf({ kind: 'push-branch', mountId: 'mount-gone' }),
        rowIds: ROW_IDS,
        looseRowId: LOOSE,
      }),
    ).toBe(LOOSE);
  });
});
