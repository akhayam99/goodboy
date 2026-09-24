import { useContext } from 'react';
import type { AgentId } from '@goodboy/types';
import { formatActiveTime } from '../../../workTreeModel/workTime';
import { WorkTimeContext, familyActiveTime } from '../../../workTreeModel/workTimeSource';

type Params = {
  readonly agentId: AgentId | null;
};

export const useElapsedLabel = ({ agentId }: Params): string | null => {
  const source = useContext(WorkTimeContext);
  if (source === null || agentId === null) {
    return null;
  }
  const active = familyActiveTime({ agentIds: [agentId], source });
  return active.hasStarted ? formatActiveTime({ ms: active.activeMs }) : null;
};
