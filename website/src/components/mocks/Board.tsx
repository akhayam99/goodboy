import './mocks.css';
import {
  BOARD_COLUMNS,
  BOARD_DELAYS,
  BOARD_HEAD,
  BOARD_LABEL,
  BOARD_TITLE,
  type BoardColumnData,
} from '../../data/harborline';
import { useAlive } from '../../hooks/useAlive';
import { BoardCard } from './BoardCard';
import { StateChip } from './StateChip';
import { WindowHead } from './WindowHead';

type Props = {
  readonly className?: string;
};

type CountParams = {
  readonly column: BoardColumnData;
  readonly hasMoved: boolean;
};

const countOf = ({ column, hasMoved }: CountParams) =>
  column.cards.filter((card) => {
    if (card.move === 'leave') {
      return !hasMoved;
    }
    if (card.move === 'arrive') {
      return hasMoved;
    }
    return true;
  }).length;

export const Board = ({ className }: Props) => {
  const { ref, step } = useAlive({ delays: BOARD_DELAYS });
  const hasLeft = step >= 1;
  const hasMoved = step >= 2;

  return (
    <div
      ref={ref}
      className={['mk-board', className].filter(Boolean).join(' ')}
      data-mock="board"
      aria-label={BOARD_LABEL}
    >
      <div className="mk-win">
        <WindowHead
          title={BOARD_TITLE}
          side={
            <>
              <StateChip
                kind="need"
                text={hasMoved ? BOARD_HEAD.needAfter : BOARD_HEAD.needBefore}
              />
              <StateChip kind="run" text={hasMoved ? BOARD_HEAD.runAfter : BOARD_HEAD.runBefore} />
            </>
          }
        />
        <div className="mk-bbody">
          <div className="mk-cols">
            {BOARD_COLUMNS.map((column) => (
              <section key={column.stage} className="mk-col" data-stage={column.stage}>
                <div className="mk-colhead">
                  <span className="mk-dot" />
                  <span>{column.name}</span>
                  <span className="mk-count mk-num">{countOf({ column, hasMoved })}</span>
                </div>
                <div className="mk-list">
                  {column.cards.map((card) => (
                    <BoardCard
                      key={`${card.move ?? 'stay'}-${card.title}`}
                      card={card}
                      isAway={card.move === 'leave' && hasLeft}
                      isShut={
                        (card.move === 'leave' && hasMoved) || (card.move === 'arrive' && !hasMoved)
                      }
                      isPre={card.move === 'arrive' && !hasMoved}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
