import { WORK_ROW, cn, tintClasses } from '@goodboy/ui';
import type { RowState } from '../../../../../workTreeModel/rowState';
import { statePresentationOf } from '../../../../../workTreeModel/statePresentation';
import { TimelineRowStateWord } from './TimelineRowStateWord';

type Props = {
  readonly state: RowState;
};

export const TimelineRowStateLine = ({ state }: Props) => {
  const shown = statePresentationOf({ state });
  if (shown === null) {
    return null;
  }
  const tone = shown.tone === 'neutral' ? 'text-muted-foreground' : tintClasses(shown.tone).text;
  return (
    <span
      data-testid="timeline-row-state"
      title={shown.word}
      className={cn(WORK_ROW.stateSlot, 'text-meta', tone)}
    >
      <TimelineRowStateWord shown={shown} />
    </span>
  );
};
