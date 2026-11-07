import type { Agent, Session } from '@goodboy/types';
import { agentPlace, useAppStore } from '../../../../store';
import { AdoptedNotice } from '../../../auto/adopt/AdoptedNotice';
import { MoveToAutoPanel } from '../../../auto/adopt/MoveToAutoPanel';
import type { AutoMembership } from '../../../auto/autoMembershipOf';
import { isTurnStateLive } from '../../agent-lifecycle';
import type { useRewriterComposer } from '../../hooks/useRewriterComposer';
import { RewriterFinishedNotice } from './RewriterFinishedNotice';

type Props = {
  readonly session: Session;
  readonly agent: Agent;
  readonly rewriter: ReturnType<typeof useRewriterComposer>;
  readonly adoption: AutoMembership['adoption'];
  readonly isMoveOpen: boolean;
  readonly onCloseMove: () => void;
};

export const AgentComposerNotice = ({
  session,
  agent,
  rewriter,
  adoption,
  isMoveOpen,
  onCloseMove,
}: Props) => {
  const navigate = useAppStore((state) => state.navigate);
  const turnState = useAppStore((state) => state.agentTurnState[agent.id] ?? null);
  if (rewriter !== null && !rewriter.isLive) {
    return <RewriterFinishedNotice sessionId={session.id} mountId={rewriter.mountId} />;
  }
  if (isMoveOpen && adoption === null) {
    return <MoveToAutoPanel sessionId={session.id} agent={agent} onClose={onCloseMove} />;
  }
  if (adoption === null) {
    return null;
  }
  return (
    <AdoptedNotice
      sessionId={session.id}
      agentId={agent.id}
      isTurnLive={isTurnStateLive({ turnState })}
      onOpenAuto={() =>
        navigate({ to: agentPlace({ sessionId: session.id, agentId: adoption.autoAgentId }) })
      }
    />
  );
};
