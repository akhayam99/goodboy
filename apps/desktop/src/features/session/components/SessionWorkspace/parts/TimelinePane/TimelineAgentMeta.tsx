import { WorkMeta, formatUsd } from '@goodboy/ui';
import { RoutingLabel } from '../../../../../../shared/components/RoutingLabel';
import { WorkTimeCell } from '../../../../../workTreeModel/components/WorkTimeCell';
import type { AgentRowWork } from '../../../../hooks/useAgentRowWork';

type Props = {
  readonly work: AgentRowWork;
  readonly costUsd: number;
  readonly isRoutingShown?: boolean;
};

export const TimelineAgentMeta = ({ work, costUsd, isRoutingShown = true }: Props) => {
  const { routing, time } = work;
  const cost = costUsd > 0 ? formatUsd(costUsd) : null;
  return (
    <WorkMeta
      isPlanned={routing.isPlanned}
      routing={
        isRoutingShown ? (
          <RoutingLabel
            isColumn
            provider={routing.provider}
            model={routing.model}
            effort={routing.effort}
            planned={routing.isPlanned ? null : routing.planned}
            isEffortObserved={routing.isEffortObserved}
          />
        ) : undefined
      }
      time={time === undefined ? undefined : <WorkTimeCell time={time} cost={cost} />}
      cost={cost}
    />
  );
};
