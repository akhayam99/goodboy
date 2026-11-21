import type { SessionId } from '@goodboy/types';
import { classifyAgent } from '../../../../session/agent-kind';
import type { AppState } from '../../../../../store/types';
import type { WakeCandidate } from './wakeImplementerOf';

type Params = {
  readonly state: Pick<AppState, 'sessionPhaseRuns' | 'agentKindOverride'>;
  readonly sessionId: SessionId;
};

export const wakeCandidatesOf = ({ state, sessionId }: Params): ReadonlyArray<WakeCandidate> =>
  (state.sessionPhaseRuns[sessionId] ?? []).map((agent) => ({
    id: agent.id,
    kind: classifyAgent({
      agent: { kind: agent.kind, name: agent.name },
      override: state.agentKindOverride[agent.id] ?? null,
    }),
    status: agent.status,
    ordinal: agent.ordinal,
    mountId: agent.mountId ?? null,
    isDeleted: agent.deletedAt != null,
  }));
