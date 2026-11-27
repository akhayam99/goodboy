import { Button } from '@goodboy/ui';
import { questionPlace, useAppStore } from '../../../../store';
import { actionButtonLookOf } from '../../../actions/actionButtonLookOf';
import type { BranchRowAction } from '../../central/board/branchRowOf';
import { tabForFactOf } from '../../../branch/tabForFactOf';
import { BoardRemoveButton } from './BoardRemoveButton';
import { BoardRowAction } from './BoardRowAction';
import { useBoardContext } from './useBoardContext';

type Props = {
  readonly rowId: string;
  readonly action: BranchRowAction;
  readonly caution: string | null;
};

const ANSWER = 'Answer';

export const BoardTileAction = ({ rowId, action, caution }: Props) => {
  const { session, rowById, entryByRowId, removal } = useBoardContext();
  const navigate = useAppStore((state) => state.navigate);
  const row = rowById.get(rowId);
  if (row === undefined) {
    return null;
  }
  switch (action.kind) {
    case 'none':
      return null;
    case 'card':
      return caution === null ? (
        <BoardRowAction rowId={rowId} index={action.index} text="" />
      ) : (
        <span title={caution} className="pointer-events-auto flex shrink-0">
          <BoardRowAction rowId={rowId} index={action.index} text="" />
        </span>
      );
    case 'remove':
      return removal.targets.every((target) => target.mountId !== action.mountId) ? null : (
        <span className="pointer-events-auto flex shrink-0">
          <BoardRemoveButton mountIds={[action.mountId]} variant="quiet" />
        </span>
      );
    case 'open': {
      const entry = entryByRowId.get(rowId);
      if (entry === undefined) {
        return null;
      }
      const look = actionButtonLookOf({ verb: action.label, variant: 'secondary' });
      return (
        <Button
          size="sm"
          variant={look.variant}
          intent={look.intent}
          className="pointer-events-auto shrink-0"
          onClick={() =>
            navigate({
              to: tabForFactOf({
                sessionId: session.id,
                mountId: entry.fact.mountId,
                fact: action.fact,
              }),
            })
          }
        >
          {action.label}
        </Button>
      );
    }
    case 'question': {
      const look = actionButtonLookOf({ verb: ANSWER, variant: 'secondary' });
      return (
        <Button
          size="sm"
          variant={look.variant}
          intent={look.intent}
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
