import { WorkMeta, formatUsd } from '@goodboy/ui';
import { RoutingBadge } from '../../../../../../shared/components/RoutingBadge';
import { WorkTimeCell } from '../../../../../workTreeModel/components/WorkTimeCell';
import type { AgentRowWork } from '../../../../hooks/useAgentRowWork';

type Props = {
  readonly work: AgentRowWork;
  readonly costUsd: number;
};

export const TimelineAgentMeta = ({ work, costUsd }: Props) => {
  const { routing, time } = work;
  return (
    <WorkMeta
      isPlanned={routing.isPlanned}
      routing={
        <RoutingBadge
          variant="bare"
          provider={routing.provider}
          model={routing.model}
          effort={routing.effort}
          planned={routing.isPlanned ? null : routing.planned}
          isEffortObserved={routing.isEffortObserved}
        />
      }
      time={time === undefined ? undefined : <WorkTimeCell time={time} />}
      cost={costUsd > 0 ? formatUsd(costUsd) : null}
    />
  );
};
