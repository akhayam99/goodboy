import { Chip } from '@goodboy/ui';
import type { Agent, AgentStatus, Session, SessionId } from '@goodboy/types';
import { STATE_CHIP_TONE } from '../../../resolve/components/ReviewFlow/stateTone';
import { useReviewEntries } from '../../../resolve/components/ReviewFlow/useReviewEntries';
import { useResolverBrief } from '../../../resolve/hooks/useResolverBrief';
import { resolveActivityWord } from '../../timeline/resolveActivity';
import { AgentStatusBadge } from '../AgentTree/AgentStatusBadge';

type Props = {
  readonly session: Session;
  readonly agent: Agent;
  readonly status: AgentStatus;
};

export const AgentResolverStatus = ({ session, agent, status }: Props) => {
  const sessionId = session.id as SessionId;
  const brief = useResolverBrief({ sessionId, agentId: agent.id });
  const { entries } = useReviewEntries({ sessionId });
  const entry = entries.find((candidate) => candidate.threadId === brief?.threadId) ?? null;
  if (entry === null) {
    return <AgentStatusBadge status={status} />;
  }
  return (
    <Chip
      tone={STATE_CHIP_TONE[entry.state]}
      size="3xs"
      bordered={false}
      label={resolveActivityWord({ state: entry.state, reviewWord: entry.word })}
      className="shrink-0"
    />
  );
};
