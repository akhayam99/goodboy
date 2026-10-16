import type { AgentId } from '@goodboy/types';
import type { LensKind } from '../../store';

type SessionSurfaceLayer = 'lens' | 'agent' | 'run';

type Params = Readonly<{
  lens: LensKind | null;
  selectedAgentId: AgentId | null;
  artifactConversationAgentId: AgentId | null;
  hasRunFocus?: boolean;
}>;

export const resolveSessionSurfaceLayer = ({
  lens,
  selectedAgentId,
  artifactConversationAgentId,
  hasRunFocus = false,
}: Params): SessionSurfaceLayer => {
  if (hasRunFocus) {
    return 'run';
  }
  if (selectedAgentId === null) {
    return 'lens';
  }
  if (lens === 'plans' && artifactConversationAgentId === selectedAgentId) {
    return 'lens';
  }
  return 'agent';
};
