import { WORK_ROW, cn, tintClasses } from '@goodboy/ui';
import type { RowState } from '../../../../../workTreeModel/rowState';
import {
  rowStateSentence,
  rowStateShortSentence,
  rowStateTone,
} from '../../../../../workTreeModel/rowStateCopy';

type Props = {
  readonly state: RowState;
  readonly note?: string | null;
};

export const TimelineRowStateLine = ({ state, note = null }: Props) => {
  const sentence = rowStateSentence({ state });
  if (sentence == null && note !== null) {
    return (
      <span
        data-testid="timeline-row-state"
        className={cn(
          'shrink-0 whitespace-nowrap text-2xs leading-4 text-faint-foreground',
          WORK_ROW.state,
        )}
      >
        {note}
      </span>
    );
  }
  if (sentence == null) {
    return null;
  }
  const short = rowStateShortSentence({ state }) ?? sentence;
  const tone = rowStateTone({ state });
  return (
    <span
      data-testid="timeline-row-state"
      title={sentence}
      className={cn(
        'shrink-0 whitespace-nowrap text-2xs leading-4',
        WORK_ROW.state,
        tone === 'neutral' ? 'text-muted-foreground' : tintClasses(tone).text,
      )}
    >
      {short === sentence ? (
        sentence
      ) : (
        <>
          <span className={WORK_ROW.stateFull}>{sentence}</span>
          <span className={WORK_ROW.stateShort}>{short}</span>
        </>
      )}
    </span>
  );
};
