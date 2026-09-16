import type { AgentId } from '@goodboy/types';
import type { LensKind } from '../../../../store';

type SessionSurfaceLayer = 'lens' | 'agent' | 'studio';

type Params = Readonly<{
  lens: LensKind | null;
  hasStudio: boolean;
  selectedAgentId: AgentId | null;
  artifactConversationAgentId: AgentId | null;
}>;

export const resolveSessionSurfaceLayer = ({
  lens,
  hasStudio,
  selectedAgentId,
  artifactConversationAgentId,
}: Params): SessionSurfaceLayer => {
  if (hasStudio) {
    return 'studio';
  }
  if (selectedAgentId === null) {
    return 'lens';
  }
  if (lens === 'plans' && artifactConversationAgentId === selectedAgentId) {
    return 'lens';
  }
  return 'agent';
};
