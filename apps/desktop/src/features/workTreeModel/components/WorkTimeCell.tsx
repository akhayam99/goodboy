import { Tooltip } from '@goodboy/ui';
import type { WorkTime } from '../workTime';

type Props = {
  readonly time: WorkTime | null;
  readonly cost?: string | null;
};

export const WorkTimeCell = ({ time, cost = null }: Props) =>
  time === null ? null : (
    <Tooltip content={cost === null ? time.detail : `${time.detail}. Cost ${cost}`}>
      <span data-testid="work-time">{time.label}</span>
    </Tooltip>
  );
