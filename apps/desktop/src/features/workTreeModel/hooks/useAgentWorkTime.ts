import { useContext } from 'react';
import type { AgentId, AgentRole, EffortLevel } from '@goodboy/types';
import { agentWorkTime, estimateKeyOf } from '../agentWorkTime';
import type { RowPhase } from '../rowState';
import type { WorkTime } from '../workTime';
import { WorkTimeContext } from '../workTimeSource';

type Params = {
  readonly agentId: AgentId;
  readonly role: AgentRole;
  readonly provider: string | null;
  readonly model: string | null;
  readonly effort: EffortLevel | null;
  readonly phase: RowPhase;
};

export const useAgentWorkTime = ({
  agentId,
  role,
  provider,
  model,
  effort,
  phase,
}: Params): WorkTime | null | undefined => {
  const source = useContext(WorkTimeContext);
  if (source === null) {
    return undefined;
  }
  return agentWorkTime({
    agentId,
    key: estimateKeyOf({ role, provider, model, effort }),
    phase,
    source,
  });
};
