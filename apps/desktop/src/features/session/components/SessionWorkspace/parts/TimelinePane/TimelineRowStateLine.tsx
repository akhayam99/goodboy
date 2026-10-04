import { WORK_ROW, cn, tintClasses } from '@goodboy/ui';
import type { RowState } from '../../../../../workTreeModel/rowState';
import { statePresentationOf } from '../../../../../workTreeModel/statePresentation';
import { TimelineRowStateWord } from './TimelineRowStateWord';

type Props = {
  readonly state: RowState;
  readonly note?: string | null;
};

export const TimelineRowStateLine = ({ state, note = null }: Props) => {
  const shown = statePresentationOf({ state });
  if (shown === null && note === null) {
    return null;
  }
  const tone =
    shown === null
      ? 'text-faint-foreground'
      : shown.tone === 'neutral'
        ? 'text-muted-foreground'
        : tintClasses(shown.tone).text;
  return (
    <span
      data-testid="timeline-row-state"
      title={shown?.word ?? note ?? undefined}
      className={cn(WORK_ROW.stateSlot, 'text-meta', tone)}
    >
      <TimelineRowStateWord shown={shown} note={note} />
    </span>
  );
};
