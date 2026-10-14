import type { AgentId, SessionId } from '@goodboy/types';
import { ciFixRoleOf } from '../../../features/branch/checks/ciFixRole';
import { classifyAgent } from '../../../features/session/agent-kind';
import type { AppState } from '../../types';

type Params = {
  readonly state: Pick<AppState, 'agentKindOverride' | 'sessionPhaseRuns' | 'transcripts'>;
  readonly sessionId: SessionId;
};

export const selectCiFixUnloadedIds = ({ state, sessionId }: Params): ReadonlyArray<AgentId> =>
  (state.sessionPhaseRuns[sessionId] ?? []).flatMap((agent) => {
    if (agent.deletedAt !== undefined || state.transcripts[agent.id] !== undefined) {
      return [];
    }
    const kind = classifyAgent({ agent, override: state.agentKindOverride[agent.id] ?? null });
    return ciFixRoleOf({ agent, kind }) === null ? [] : [agent.id];
  });
