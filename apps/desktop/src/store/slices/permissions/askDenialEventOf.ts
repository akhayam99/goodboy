import type { IsoDateTime, ProviderRunId, TurnEvent } from '@goodboy/types';

type Params = {
  readonly runId: ProviderRunId;
  readonly toolUseId: string;
  readonly reason: string;
  readonly at: IsoDateTime;
};

export const askDenialEventOf = ({ runId, toolUseId, reason, at }: Params): TurnEvent => {
  const trimmed = reason.trim();
  return {
    kind: 'permission_decision',
    runId,
    toolUseId,
    decision: 'deny',
    scope: 'once',
    ruleId: null,
    decidedBy: 'user',
    ...(trimmed !== '' && { reason: trimmed }),
    at,
  };
};
