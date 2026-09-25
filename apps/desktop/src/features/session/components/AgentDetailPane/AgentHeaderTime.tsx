import { Tooltip } from '@goodboy/ui';
import type { WorkTime } from '../../../workTreeModel/workTime';

type Props = {
  readonly time: WorkTime;
};

export const AgentHeaderTime = ({ time }: Props) => (
  <Tooltip content={time.detail}>
    <span
      data-testid="agent-header-time"
      className="shrink-0 text-2xs tabular-nums text-muted-foreground"
    >
      {time.headline}
    </span>
  </Tooltip>
);
