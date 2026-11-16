import { Button } from '@goodboy/ui';
import { questionPlace, useAppStore } from '../../../../store';
import { actionButtonLookOf } from '../../../actions/actionButtonLookOf';
import { boardTileActionOf } from '../../central/board/boardTileActionOf';
import { BoardRowAction } from './BoardRowAction';
import { useBoardContext } from './useBoardContext';

type Props = {
  readonly rowId: string;
};

const ANSWER = 'Answer';

export const BoardTileAction = ({ rowId }: Props) => {
  const { session, rowById, cardsByRowId } = useBoardContext();
  const navigate = useAppStore((state) => state.navigate);
  const row = rowById.get(rowId);
  if (row === undefined) {
    return null;
  }
  const action = boardTileActionOf({ row, cards: cardsByRowId.get(rowId) ?? [] });
  switch (action.kind) {
    case 'none':
      return null;
    case 'card':
      return <BoardRowAction rowId={rowId} index={action.index} text="" />;
    case 'question': {
      const look = actionButtonLookOf({ verb: ANSWER, variant: 'primary' });
      return (
        <Button
          size="sm"
          variant={look.variant}
          intent={look.intent}
          aria-label={`${ANSWER} the question on ${row.branch ?? 'this work'}`}
          className="pointer-events-auto shrink-0"
          onClick={() =>
            navigate({
              to: questionPlace({ sessionId: session.id, questionId: action.questionId }),
            })
          }
        >
          {ANSWER}
        </Button>
      );
    }
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
};
