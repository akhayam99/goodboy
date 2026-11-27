import type { AgentId, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import type { AppState } from '../../../../../store/types';
import {
  openPermissionAsksOf,
  type OpenPermissionAsk,
} from '../../../../permissions/openPermissionAsksOf';

type Params = {
  readonly sessionId: SessionId;
  readonly isEnabled: boolean;
};

type StateParams = {
  readonly state: AppState;
  readonly sessionId: SessionId;
};

export type SessionPermissionAsk = Readonly<{
  agentId: AgentId;
  ask: OpenPermissionAsk;
}>;

const askingAgentIdOf = ({ state, sessionId }: StateParams): AgentId | null =>
  (state.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY).find(
    (agent) =>
      openPermissionAsksOf({
        events: state.transcripts[agent.id] ?? EMPTY_ARRAY,
        turnState: state.agentTurnState[agent.id],
      }).length > 0,
  )?.id ?? null;

export const useSessionPermissionAsk = ({
  sessionId,
  isEnabled,
}: Params): SessionPermissionAsk | null => {
  const agentId = useAppStore((state) =>
    isEnabled ? askingAgentIdOf({ state, sessionId }) : null,
  );
  const events = useAppStore((state) =>
    agentId === null ? undefined : state.transcripts[agentId],
  );
  const turnState = useAppStore((state) =>
    agentId === null ? undefined : state.agentTurnState[agentId],
  );
  if (agentId === null) {
    return null;
  }
  const [ask] = openPermissionAsksOf({ events: events ?? EMPTY_ARRAY, turnState });
  return ask === undefined ? null : { agentId, ask };
};
