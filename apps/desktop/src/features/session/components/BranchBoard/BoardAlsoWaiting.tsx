import { BoardCardSecond } from './BoardCardSecond';
import { BoardRowAction } from './BoardRowAction';
import { useBoardContext } from './useBoardContext';

type Props = {
  readonly rowId: string;
};

export const BoardAlsoWaiting = ({ rowId }: Props) => {
  const { cardsByRowId, actionsFor } = useBoardContext();
  const cards = cardsByRowId.get(rowId) ?? [];
  const [first] = cards;
  const hasFirstSecond = first !== undefined && actionsFor({ card: first }).second !== null;
  if (cards.length < 2 && !hasFirstSecond) {
    return null;
  }
  return (
    <section
      aria-label="Also waiting for you"
      data-board-also-waiting=""
      className="flex min-w-0 flex-col gap-2"
    >
      <h3 className="text-row-strong text-foreground">Also waiting for you</h3>
      {hasFirstSecond ? (
        <div className="flex min-h-8 min-w-0 items-center gap-2 text-meta">
          <BoardCardSecond rowId={rowId} index={0} />
        </div>
      ) : null}
      {cards.slice(1).map((card, position) => (
        <div key={card.id} className="flex min-h-8 min-w-0 items-center gap-2 text-meta">
          <BoardRowAction rowId={rowId} index={position + 1} />
          <BoardCardSecond rowId={rowId} index={position + 1} />
        </div>
      ))}
    </section>
  );
};
