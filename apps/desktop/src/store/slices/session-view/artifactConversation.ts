import type { AgentId, SessionId } from '@goodboy/types';
import type { GetFn, SetFn } from './types';

type Params = Readonly<{
  sessionId: SessionId;
  agentId: AgentId;
}>;

export const openArtifactConversation = (set: SetFn, get: GetFn) => {
  return ({ sessionId, agentId }: Params): void => {
    set((s) => ({
      artifactConversationAgentId: { ...s.artifactConversationAgentId, [sessionId]: agentId },
    }));
    void get().selectAgent(sessionId, agentId);
  };
};

export const closeArtifactConversation = (set: SetFn) => {
  return ({ sessionId, agentId }: Params): void => {
    set((s) => {
      if ((s.artifactConversationAgentId[sessionId] ?? null) !== agentId) {
        return {};
      }
      return {
        artifactConversationAgentId: { ...s.artifactConversationAgentId, [sessionId]: null },
        ...((s.selectedAgentId[sessionId] ?? null) === agentId
          ? { selectedAgentId: { ...s.selectedAgentId, [sessionId]: null } }
          : {}),
      };
    });
  };
};
