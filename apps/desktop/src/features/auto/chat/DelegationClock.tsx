import { useContext } from 'react';
import type { AgentId } from '@goodboy/types';
import { agentActiveClock } from '../../workTreeModel/agentWorkTime';
import { WorkTimeContext } from '../../workTreeModel/workTimeSource';

type Props = {
  readonly agentId: AgentId;
  readonly isLive: boolean;
};

export const DelegationClock = ({ agentId, isLive }: Props) => {
  const source = useContext(WorkTimeContext);
  const clock =
    source === null ? null : agentActiveClock({ agentId, unit: 'step', isRunning: isLive, source });
  if (clock === null) {
    return null;
  }
  return (
    <span
      data-delegation-clock=""
      className="shrink-0 text-meta tabular-nums text-faint-foreground"
    >
      {clock}
    </span>
  );
};
