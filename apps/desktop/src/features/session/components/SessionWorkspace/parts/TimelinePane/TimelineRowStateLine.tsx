import { WORK_ROW, cn, Tooltip } from '@goodboy/ui';
import type { RowState } from '../../../../../workTreeModel/rowState';
import { statePresentationOf } from '../../../../../workTreeModel/statePresentation';
import { TimelineRowStateWord } from './TimelineRowStateWord';

type Props = {
  readonly state: RowState;
};

export const TimelineRowStateLine = ({ state }: Props) => {
  const shown = statePresentationOf({ state });
  if (shown === null || state.reason?.kind === 'question') {
    return null;
  }
  return (
    <Tooltip content={shown.word}>
      <span
        data-testid="timeline-row-state"
        className={cn(WORK_ROW.stateSlot, 'text-meta text-muted-foreground')}
      >
        <TimelineRowStateWord shown={shown} />
      </span>
    </Tooltip>
  );
};
