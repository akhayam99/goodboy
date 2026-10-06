import { Button } from '@goodboy/ui';
import type { ResolvedAction } from '../../../actions/types';

type Props = {
  readonly actions: ReadonlyArray<ResolvedAction>;
  readonly state: string;
  readonly pendingActionId: string | null;
  readonly onRun: (actionId: string) => void;
};

const STEER_IDS: ReadonlyArray<string> = [
  'reviewComment.fixItAnyway',
  'reviewComment.replyOnly',
  'reviewComment.rewriteReply',
];

export const steerActionsOf = ({
  actions,
  state,
}: Pick<Props, 'actions' | 'state'>): ReadonlyArray<ResolvedAction> => [
  ...STEER_IDS.flatMap((id) => actions.filter((action) => action.id === id)),
  ...(state === 'replied'
    ? actions.filter((action) => action.id === 'reviewComment.editReply')
    : []),
];

export const SteerLine = ({ actions, state, pendingActionId, onRun }: Props) => {
  const steer = steerActionsOf({ actions, state });
  if (steer.length === 0) {
    return null;
  }
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {steer.map((action) => (
        <Button
          key={action.id}
          size="sm"
          variant="ghost"
          data-review-verb={action.id}
          disabled={
            action.blockedReason !== null ||
            (pendingActionId !== null && pendingActionId !== action.id)
          }
          isBusy={pendingActionId === action.id}
          onClick={() => onRun(action.id)}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
};
