import { cn, tintClasses } from '@goodboy/ui';
import type { RowState } from '../../../../../workTreeModel/rowState';
import { rowStateSentence, rowStateTone } from '../../../../../workTreeModel/rowStateCopy';

type Props = {
  readonly state: RowState;
};

export const TimelineRowStateLine = ({ state }: Props) => {
  const sentence = rowStateSentence({ state });
  if (sentence == null) {
    return null;
  }
  const tone = rowStateTone({ state });
  return (
    <span
      data-testid="timeline-row-state"
      className={cn(
        'min-w-0 max-w-1/2 shrink-[4] truncate text-2xs leading-4',
        tone === 'neutral' ? 'text-muted-foreground' : tintClasses(tone).text,
      )}
    >
      {sentence}
    </span>
  );
};
