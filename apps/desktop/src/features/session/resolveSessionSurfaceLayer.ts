import type { AgentId } from '@goodboy/types';
import type { LensKind } from '../../store';

type SessionSurfaceLayer = 'lens' | 'agent';

type Params = Readonly<{
  lens: LensKind | null;
  selectedAgentId: AgentId | null;
  artifactConversationAgentId: AgentId | null;
}>;

export const resolveSessionSurfaceLayer = ({
  lens,
  selectedAgentId,
  artifactConversationAgentId,
}: Params): SessionSurfaceLayer => {
  if (selectedAgentId === null) {
    return 'lens';
  }
  if (lens === 'plans' && artifactConversationAgentId === selectedAgentId) {
    return 'lens';
  }
  return 'agent';
};
