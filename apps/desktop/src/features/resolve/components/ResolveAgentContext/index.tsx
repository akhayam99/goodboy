import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { ResolveAgentContextStrip } from './ResolveAgentContextStrip';

type Props = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId | null;
};

export const ResolveAgentContext = ({ sessionId, agentId }: Props) => {
  const origin = useAppStore((s) => s.resolveAgentReturn[sessionId] ?? null);
  if (origin === null || agentId === null || origin.agentId !== agentId) {
    return null;
  }
  return (
    <ResolveAgentContextStrip
      sessionId={sessionId}
      threadId={origin.threadId}
      prNumber={origin.prNumber}
    />
  );
};
