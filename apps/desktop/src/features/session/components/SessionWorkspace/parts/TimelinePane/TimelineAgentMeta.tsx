import { WorkMeta, formatUsd } from '@goodboy/ui';
import { RoutingBadge } from '../../../../../../shared/components/RoutingBadge';
import { WorkTimeCell } from '../../../../../workTreeModel/components/WorkTimeCell';
import type { AgentRowWork } from '../../../../hooks/useAgentRowWork';

type Props = {
  readonly work: AgentRowWork;
  readonly costUsd: number;
  readonly shouldKeepCost: boolean;
};

export const TimelineAgentMeta = ({ work, costUsd, shouldKeepCost }: Props) => {
  const { routing, time } = work;
  return (
    <WorkMeta
      isPlanned={routing.isPlanned}
      shouldKeepCost={shouldKeepCost}
      routing={
        <RoutingBadge
          variant="bare"
          provider={routing.provider}
          model={routing.model}
          effort={routing.effort}
          planned={routing.isPlanned ? null : routing.planned}
        />
      }
      time={time === undefined ? undefined : <WorkTimeCell time={time} />}
      cost={costUsd > 0 ? formatUsd(costUsd) : null}
    />
  );
};
