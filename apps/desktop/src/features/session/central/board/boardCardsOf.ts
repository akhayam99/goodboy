import type { ActionCardModel } from '../next/actionCardsOf';
import type { BoardRow } from './boardTypes';
import { cardRowIdOf } from './cardRowIdOf';

type Params = {
  readonly cards: ReadonlyArray<ActionCardModel>;
  readonly rows: ReadonlyArray<BoardRow>;
};

export type BoardCards = Readonly<{
  byRowId: ReadonlyMap<string, ReadonlyArray<ActionCardModel>>;
  loose: ReadonlyArray<ActionCardModel>;
}>;

const SESSION_LEVEL_KINDS: ReadonlySet<string> = new Set(['archive-session', 'close-worktree']);

const MERGE_KIND = 'merge-series';

const LOOSE_ROW_ID = 'loose';

export const boardCardsOf = ({ cards, rows }: Params): BoardCards => {
  const rowIds = new Set(rows.map((row) => row.id));
  const rowIdByAskId = new Map(
    rows.flatMap((row) => row.askIds.map((askId) => [askId, row.id] as const)),
  );
  const byRowId = new Map<string, ReadonlyArray<ActionCardModel>>();
  const loose: Array<ActionCardModel> = [];
  for (const card of cards) {
    if (SESSION_LEVEL_KINDS.has(card.kind) || card.kind === MERGE_KIND) {
      continue;
    }
    const rowId = cardRowIdOf({ card, rowIds, looseRowId: LOOSE_ROW_ID, rowIdByAskId });
    if (!rowIds.has(rowId)) {
      loose.push(card);
      continue;
    }
    byRowId.set(rowId, [...(byRowId.get(rowId) ?? []), card]);
  }
  return { byRowId, loose };
};
