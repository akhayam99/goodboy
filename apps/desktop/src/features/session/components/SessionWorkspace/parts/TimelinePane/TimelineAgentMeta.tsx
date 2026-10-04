import { useContext } from 'react';
import { WorkMeta, formatUsd } from '@goodboy/ui';
import { RoutingLabel } from '../../../../../../shared/components/RoutingLabel';
import { WorkTimeCell } from '../../../../../workTreeModel/components/WorkTimeCell';
import type { AgentRowWork } from '../../../../hooks/useAgentRowWork';
import { TimelineRouting, isModelNameShown, isProviderGlyphShown } from './timelineRouting';

type Props = {
  readonly work: AgentRowWork;
  readonly costUsd: number;
  readonly agentId?: string;
};

export const TimelineAgentMeta = ({ work, costUsd, agentId }: Props) => {
  const { routing, time } = work;
  const facts = useContext(TimelineRouting);
  const cost = costUsd > 0 ? formatUsd(costUsd) : null;
  return (
    <WorkMeta
      isPlanned={routing.isPlanned}
      routing={
        <RoutingLabel
          isColumn
          hideGlyph={!isProviderGlyphShown({ facts })}
          hideName={!isModelNameShown({ facts, agentId })}
          provider={routing.provider}
          model={routing.model}
          effort={routing.effort}
          planned={routing.isPlanned ? null : routing.planned}
          isEffortObserved={routing.isEffortObserved}
        />
      }
      time={time === undefined ? undefined : <WorkTimeCell time={time} cost={cost} />}
      cost={cost}
    />
  );
};
