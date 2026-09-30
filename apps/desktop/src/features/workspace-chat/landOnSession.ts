import type { Agent, AgentId, SessionId } from '@goodboy/types';
import { sessionPlace } from '../../store/slices/navigation/place';
import type { AppStore } from '../../store/store';

type AgentsParams = {
  readonly agents: ReadonlyArray<Agent>;
};

export const draftAgentOf = ({ agents }: AgentsParams): AgentId | null => {
  const candidates = agents.filter(
    (agent) => agent.deletedAt === undefined && agent.parentAgentId === undefined,
  );
  return (
    candidates.reduce<Agent | null>(
      (latest, agent) => (latest === null || agent.ordinal > latest.ordinal ? agent : latest),
      null,
    )?.id ?? null
  );
};

type Params = {
  readonly sessionId: SessionId;
  readonly draft: string | null;
  readonly navigate: AppStore['navigate'];
  readonly loadPhaseRunsForSession: AppStore['loadPhaseRunsForSession'];
  readonly readAgents: (params: { readonly sessionId: SessionId }) => ReadonlyArray<Agent>;
  readonly readDraft: (params: { readonly agentId: AgentId }) => string;
  readonly setAgentDraft: AppStore['setAgentDraft'];
};

export const landOnSession = async ({
  sessionId,
  draft,
  navigate,
  loadPhaseRunsForSession,
  readAgents,
  readDraft,
  setAgentDraft,
}: Params): Promise<boolean> => {
  navigate({ to: sessionPlace({ sessionId }) });
  if (draft === null) {
    return false;
  }
  try {
    await loadPhaseRunsForSession(sessionId);
  } catch {
    return false;
  }
  const agentId = draftAgentOf({ agents: readAgents({ sessionId }) });
  if (agentId === null) {
    return false;
  }
  const pending = readDraft({ agentId });
  setAgentDraft(agentId, pending.trim() === '' ? draft : `${pending}\n\n${draft}`);
  navigate({ to: sessionPlace({ sessionId, agentId }), mode: 'replace' });
  return true;
};
