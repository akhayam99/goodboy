import { Tooltip, WORK_META_COLUMN, cn, tintClasses } from '@goodboy/ui';
import { TIME_LEFT_SUFFIX, type WorkTime } from '../workTime';

type Props = {
  readonly time: WorkTime | null;
  readonly cost?: string | null;
  readonly note?: string | null;
};

export const WorkTimeCell = ({ time, cost = null, note = null }: Props) => {
  if (time === null) {
    return null;
  }
  const isLeft = time.label.endsWith(TIME_LEFT_SUFFIX);
  const detail = cost === null ? time.detail : `${time.detail}. Cost ${cost}`;
  return (
    <>
      <Tooltip content={note === null ? detail : `${note}. ${detail}`}>
        <span
          data-testid="work-time"
          data-note={note === null ? undefined : 'true'}
          className={cn(note !== null && tintClasses('warning').text)}
        >
          {isLeft ? (
            <>
              {time.label.slice(0, -TIME_LEFT_SUFFIX.length)}
              <span className={WORK_META_COLUMN.timeSuffix}>{TIME_LEFT_SUFFIX}</span>
            </>
          ) : (
            time.label
          )}
        </span>
      </Tooltip>
      {note === null ? null : <span className="sr-only">{note}</span>}
    </>
  );
};
