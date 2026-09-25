import { Tooltip } from '@goodboy/ui';
import type { WorkTime } from '../workTime';

type Props = {
  readonly time: WorkTime | null;
};

export const WorkTimeCell = ({ time }: Props) =>
  time === null ? null : (
    <Tooltip content={time.detail}>
      <span data-testid="work-time">{time.label}</span>
    </Tooltip>
  );
