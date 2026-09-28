import type { AgentId, SessionId, WorkspaceId } from '@goodboy/types';
import type { CommitScope, PaletteScope } from './types';

type Params = {
  readonly currentWorkspaceId: WorkspaceId | null;
  readonly currentSessionId: SessionId | null;
  readonly selectedAgentId: AgentId | null;
  readonly hasStudio: boolean;
  readonly heldScope: CommitScope | null;
};

export const resolvePaletteScope = ({
  currentWorkspaceId,
  currentSessionId,
  selectedAgentId,
  hasStudio,
  heldScope,
}: Params): PaletteScope | null => {
  if (heldScope !== null) {
    return heldScope;
  }
  if (currentSessionId !== null && selectedAgentId !== null && !hasStudio) {
    return { kind: 'agent', sessionId: currentSessionId, agentId: selectedAgentId };
  }
  if (currentSessionId !== null) {
    return { kind: 'session', sessionId: currentSessionId };
  }
  if (currentWorkspaceId !== null) {
    return { kind: 'workspace', workspaceId: currentWorkspaceId };
  }
  return null;
};
