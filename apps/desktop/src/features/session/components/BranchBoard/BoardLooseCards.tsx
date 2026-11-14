import { BoardCardSecond } from './BoardCardSecond';
import { BoardRowAction } from './BoardRowAction';
import { LOOSE_ROW_ID } from './looseRowId';
import { useBoardContext } from './useBoardContext';

export const BoardLooseCards = () => {
  const { cardsByRowId } = useBoardContext();
  const cards = cardsByRowId.get(LOOSE_ROW_ID) ?? [];
  if (cards.length === 0) {
    return null;
  }
  return (
    <section
      aria-label="Next steps"
      data-board-loose=""
      className="flex min-w-0 flex-col gap-2 px-2"
    >
      {cards.map((card, index) => (
        <div key={card.id} className="flex min-h-8 min-w-0 items-center gap-2 text-meta">
          <BoardRowAction rowId={LOOSE_ROW_ID} index={index} />
          <BoardCardSecond rowId={LOOSE_ROW_ID} index={index} />
        </div>
      ))}
    </section>
  );
};
