import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { FixRunAgentChecks } from './FixRunAgentChecks';

type Props = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

export const FixRunChecks = ({ sessionId, agentId }: Props) => {
  const agent = useAppStore(
    (s) => s.sessionPhaseRuns[sessionId]?.find((candidate) => candidate.id === agentId) ?? null,
  );
  return agent === null ? null : <FixRunAgentChecks agent={agent} />;
};
