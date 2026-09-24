import { useContext } from 'react';
import type { AgentId, AgentRole, EffortLevel, StepSize } from '@goodboy/types';
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
  readonly size: StepSize | null;
  readonly phase: RowPhase;
};

export const useAgentWorkTime = ({
  agentId,
  role,
  provider,
  model,
  effort,
  size,
  phase,
}: Params): WorkTime | null | undefined => {
  const source = useContext(WorkTimeContext);
  if (source === null) {
    return undefined;
  }
  return agentWorkTime({
    agentId,
    key: estimateKeyOf({ role, provider, model, effort, size }),
    phase,
    source,
  });
};
