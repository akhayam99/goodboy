import type { Agent, AgentId, MountId, SessionId } from '@goodboy/types';
import type { AppState } from '../../types';

export type MountPresenceState = 'running' | 'needsUser' | 'question';

export type MountPresenceAgent = Readonly<{
  agentId: AgentId;
  name: string;
  state: MountPresenceState;
}>;

type PresenceState = Pick<
  AppState,
  'sessionPhaseRuns' | 'agentTurnDestination' | 'agentTurnState' | 'sessionOpenQuestions'
>;

type Params = {
  readonly state: PresenceState;
  readonly sessionId: SessionId;
  readonly mountId: MountId;
};

type StateParams = {
  readonly state: PresenceState;
  readonly agent: Agent;
  readonly askingAgentIds: ReadonlySet<AgentId>;
};

const presenceStateOf = ({
  state,
  agent,
  askingAgentIds,
}: StateParams): MountPresenceState | null => {
  if (askingAgentIds.has(agent.id)) {
    return 'question';
  }
  const turnKind = state.agentTurnState[agent.id]?.kind;
  if (turnKind === 'running' || turnKind === 'starting') {
    return 'running';
  }
  if (turnKind === 'blocked') {
    return 'needsUser';
  }
  return null;
};

export const selectMountPresence = ({
  state,
  sessionId,
  mountId,
}: Params): ReadonlyArray<MountPresenceAgent> => {
  const agents = state.sessionPhaseRuns[sessionId] ?? [];
  const askingAgentIds = new Set(
    (state.sessionOpenQuestions[sessionId] ?? []).flatMap((question) =>
      question.createdByAgentId === undefined ? [] : [question.createdByAgentId],
    ),
  );
  return [...agents]
    .sort((a, b) => a.ordinal - b.ordinal)
    .flatMap((agent) => {
      if (agent.deletedAt !== undefined) {
        return [];
      }
      const destination = state.agentTurnDestination[agent.id];
      if (destination?.kind !== 'mount' || destination.mountId !== mountId) {
        return [];
      }
      const presence = presenceStateOf({ state, agent, askingAgentIds });
      return presence === null ? [] : [{ agentId: agent.id, name: agent.name, state: presence }];
    });
};
