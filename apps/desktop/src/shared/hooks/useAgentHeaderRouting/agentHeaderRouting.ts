import type { EffortLevel } from '@goodboy/types';
import type { AgentRowRouting } from '../../../features/session/timeline/agentRowRouting';

type ReferenceRouting = {
  readonly provider: string;
  readonly model: string;
  readonly effort: EffortLevel;
};

type Params = {
  readonly row: AgentRowRouting;
  readonly reference: ReferenceRouting | null;
  readonly isLive: boolean;
};

export type AgentHeaderRouting = {
  readonly provider: string | null;
  readonly model: string | null;
  readonly effort: EffortLevel | null;
  readonly planned: AgentRowRouting['planned'];
  readonly isEffortObserved: boolean;
  readonly isNextTurn: boolean;
};

export const agentHeaderRouting = ({ row, reference, isLive }: Params): AgentHeaderRouting => {
  if (row.model != null) {
    return {
      provider: row.provider,
      model: row.model,
      effort: row.effort,
      planned: row.planned,
      isEffortObserved: row.isEffortObserved,
      isNextTurn: row.isPlanned && isLive,
    };
  }
  if (isLive && reference != null) {
    return {
      provider: reference.provider,
      model: reference.model,
      effort: reference.effort,
      planned: null,
      isEffortObserved: false,
      isNextTurn: true,
    };
  }
  return {
    provider: row.provider,
    model: null,
    effort: row.effort,
    planned: row.planned,
    isEffortObserved: row.isEffortObserved,
    isNextTurn: false,
  };
};
