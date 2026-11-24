import { AUTO_DELEGATION_ROLES, isAutoOwnProvider, isAutoRoleStartable } from '@goodboy/core/auto';
import { formatCandidatesBlock } from '@goodboy/core/providers';
import type { SessionId } from '@goodboy/types';
import { readProviderAgentTurns } from '../../models/readProviderAgentTurns';
import { selectCandidateInputs, type CandidateState } from '../../models/selectCandidateInputs';

const STARTABLE_ROLES = AUTO_DELEGATION_ROLES.filter((role) => isAutoRoleStartable({ role }));

type Params = {
  readonly state: CandidateState;
  readonly sessionId: SessionId;
  readonly nowMs: number;
};

export const leadCandidatesBlock = async ({
  state,
  sessionId,
  nowMs,
}: Params): Promise<string | null> => {
  const connected = (state.providers ?? []).filter(
    (provider) =>
      provider.connection === 'connected' && isAutoOwnProvider({ provider: provider.id }),
  );
  if (connected.length < 2) {
    return null;
  }
  const turns = await readProviderAgentTurns({ nowMs });
  return formatCandidatesBlock({
    inputs: selectCandidateInputs({ state, sessionId, nowMs, turns }),
    roles: STARTABLE_ROLES,
    scope: 'helper',
  });
};
