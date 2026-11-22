// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type AgentId } from '@goodboy/types';
import type { ActionCardModel, AutoActionTarget } from '../next/actionCardsOf';
import { boardCardsOf } from './boardCardsOf';
import type { BoardRow } from './boardTypes';

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
  readonly id: string;
  readonly kind: ActionCardModel['kind'];
  readonly mountId: string | null;
};

const cardOf = ({ id, kind, mountId }: CardParams): ActionCardModel => ({
  id,
  band: 1,
  priority: 0,
  kind,
  title: 'Rebase ledger-core',
  detail: null,
  mountId,
  source: { kind: 'auto', target: TARGET },
  folded: [],
  reason: null,
  evidence: [],
});

type RowParams = {
  readonly id: string;
};

const rowOf = ({ id }: RowParams): BoardRow => ({
  id,
  mountId: id,
  projectId: null,
  projectName: 'ledger-core',
  branch: 'nw/ledger-rounding',
  group: 'in-progress',
  isMerged: false,
  isClosed: false,
  isSettled: false,
  stage: { stage: 'building', reason: '', addsFact: false, attention: null, prState: null },
  checks: null,
  askIds: [],
  agentIds: [],
  leadIds: [],
  needsYouIds: [],
  spendUsd: 0,
  elapsedMs: 0,
});

describe('boardCardsOf', () => {
  it('puts each card on the row of its branch', () => {
    const push = cardOf({ id: 'push', kind: 'push-branch', mountId: 'mount-a' });
    const placed = boardCardsOf({ cards: [push], rows: [rowOf({ id: 'mount-a' })] });

    expect(placed.byRowId.get('mount-a')).toEqual([push]);
    expect(placed.loose).toEqual([]);
  });

  it('keeps a card whose branch has no row in the loose list instead of dropping it', () => {
    const gone = cardOf({ id: 'gone', kind: 'rebase-project', mountId: 'mount-gone' });
    const unbranched = cardOf({ id: 'unbranched', kind: 'push-branch', mountId: null });
    const noRow = cardOf({ id: 'no-row', kind: 'question', mountId: null });
    const placed = boardCardsOf({
      cards: [gone, unbranched, noRow],
      rows: [rowOf({ id: 'mount-a' })],
    });

    expect(placed.loose).toEqual([gone, unbranched, noRow]);
    expect([...placed.byRowId.keys()]).toEqual([]);
  });

  it('leaves session moves and the merge door out of both lists', () => {
    const placed = boardCardsOf({
      cards: [
        cardOf({ id: 'archive', kind: 'archive-session', mountId: null }),
        cardOf({ id: 'merge', kind: 'merge-series', mountId: null }),
      ],
      rows: [],
    });

    expect(placed.loose).toEqual([]);
    expect(placed.byRowId.size).toBe(0);
  });
});
