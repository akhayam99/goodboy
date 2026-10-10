import type { AgentId, SessionId, WorkflowRunId, WorkspaceId } from '@goodboy/types';
import type { LensKind } from '../../store';
import { resolveSessionSurfaceLayer } from '../session/resolveSessionSurfaceLayer';
import type { HeldScope, PaletteScope } from './types';

type Params = {
  readonly currentWorkspaceId: WorkspaceId | null;
  readonly currentSessionId: SessionId | null;
  readonly selectedAgentId: AgentId | null;
  readonly artifactConversationAgentId?: AgentId | null;
  readonly lens?: LensKind | null;
  readonly hasStudio: boolean;
  readonly hasAppStudio?: boolean;
  readonly focusedRunId?: WorkflowRunId | null;
  readonly prNumber?: number | null;
  readonly heldScope: HeldScope | null;
};

export const resolvePaletteScope = ({
  currentWorkspaceId,
  currentSessionId,
  selectedAgentId,
  artifactConversationAgentId = null,
  lens = null,
  hasStudio,
  hasAppStudio = false,
  focusedRunId = null,
  prNumber = null,
  heldScope,
}: Params): PaletteScope | null => {
  if (heldScope !== null) {
    return heldScope;
  }
  if (hasAppStudio && currentWorkspaceId !== null) {
    return { kind: 'workspace', workspaceId: currentWorkspaceId };
  }
  if (currentSessionId !== null) {
    const layer = resolveSessionSurfaceLayer({
      lens,
      hasStudio,
      selectedAgentId,
      artifactConversationAgentId,
    });
    if (layer === 'agent' && selectedAgentId !== null) {
      return { kind: 'agent', sessionId: currentSessionId, agentId: selectedAgentId };
    }
    if (layer === 'lens' && lens === 'workflows' && focusedRunId !== null) {
      return { kind: 'workflowRun', sessionId: currentSessionId, runId: focusedRunId };
    }
    if (layer === 'lens' && lens === 'branch' && prNumber !== null) {
      return { kind: 'pullRequest', sessionId: currentSessionId, prNumber };
    }
    return { kind: 'session', sessionId: currentSessionId };
  }
  if (currentWorkspaceId !== null) {
    return { kind: 'workspace', workspaceId: currentWorkspaceId };
  }
  return null;
};
