import { Tooltip, WORK_META_COLUMN } from '@goodboy/ui';
import { TIME_LEFT_SUFFIX, type WorkTime } from '../workTime';

type Props = {
  readonly time: WorkTime | null;
  readonly cost?: string | null;
};

export const WorkTimeCell = ({ time, cost = null }: Props) => {
  if (time === null) {
    return null;
  }
  const isLeft = time.label.endsWith(TIME_LEFT_SUFFIX);
  return (
    <Tooltip content={cost === null ? time.detail : `${time.detail}. Cost ${cost}`}>
      <span data-testid="work-time">
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
  );
};
