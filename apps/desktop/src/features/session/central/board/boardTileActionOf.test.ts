// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { ActionCardModel } from '../next/actionCardsOf';
import { boardTileActionOf } from './boardTileActionOf';
import type { BoardRow } from './boardTypes';

type RowParams = {
  readonly askIds?: ReadonlyArray<string>;
  readonly isMerged?: boolean;
  readonly isClosed?: boolean;
};

const rowOf = ({ askIds = [], isMerged = false, isClosed = false }: RowParams): BoardRow => ({
  id: 'ledger',
  mountId: 'ledger',
  projectId: null,
  projectName: 'ledger-core',
  branch: 'nw/ledger-rounding',
  group: isMerged ? 'merged' : isClosed ? 'closed' : 'in-progress',
  isMerged,
  isClosed,
  isSettled: isMerged || isClosed,
  stage: {
    stage: 'building',
    reason: '',
    addsFact: false,
    attention: null,
    prState: null,
  },
  checks: null,
  askIds,
  agentIds: [],
  leadIds: [],
  needsYouIds: askIds,
  spendUsd: 0,
  elapsedMs: 0,
});

type CardParams = {
  readonly kind: ActionCardModel['kind'];
};

const cardOf = ({ kind }: CardParams): Pick<ActionCardModel, 'kind'> => ({ kind });

const NO_ASKS: ReadonlySet<string> = new Set();

describe('boardTileActionOf', () => {
  it('takes the first card of the branch when nothing is asked', () => {
    expect(
      boardTileActionOf({
        row: rowOf({}),
        cards: [cardOf({ kind: 'rebase-project' }), cardOf({ kind: 'push-branch' })],
        shownAskIds: NO_ASKS,
      }),
    ).toEqual({ kind: 'card', index: 0 });
  });

  it('puts Answer first: the question card wins over an earlier rebase', () => {
    expect(
      boardTileActionOf({
        row: rowOf({ askIds: ['question-1'] }),
        cards: [cardOf({ kind: 'rebase-project' }), cardOf({ kind: 'question' })],
        shownAskIds: NO_ASKS,
      }),
    ).toEqual({ kind: 'card', index: 1 });
  });

  it('opens the first question when no card answers it', () => {
    expect(
      boardTileActionOf({
        row: rowOf({ askIds: ['question-1', 'question-2'] }),
        cards: [cardOf({ kind: 'rebase-project' })],
        shownAskIds: NO_ASKS,
      }),
    ).toEqual({ kind: 'question', questionId: 'question-1' });
  });

  it('carries no Answer for a question Needs you already shows', () => {
    expect(
      boardTileActionOf({
        row: rowOf({ askIds: ['question-1'] }),
        cards: [cardOf({ kind: 'rebase-project' })],
        shownAskIds: new Set(['question-1']),
      }),
    ).toEqual({ kind: 'none' });
  });

  it('offers Remove worktree on a merged branch, never its cards', () => {
    expect(
      boardTileActionOf({
        row: rowOf({ isMerged: true }),
        cards: [cardOf({ kind: 'push-branch' })],
        shownAskIds: NO_ASKS,
      }),
    ).toEqual({ kind: 'remove', mountId: 'ledger' });
  });

  it('offers nothing on a closed request, never Remove worktree', () => {
    expect(
      boardTileActionOf({
        row: rowOf({ isClosed: true }),
        cards: [cardOf({ kind: 'push-branch' })],
        shownAskIds: NO_ASKS,
      }),
    ).toEqual({ kind: 'none' });
  });

  it('offers nothing on a branch with nothing waiting', () => {
    expect(boardTileActionOf({ row: rowOf({}), cards: [], shownAskIds: NO_ASKS })).toEqual({
      kind: 'none',
    });
  });
});
