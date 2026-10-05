import { Band } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { ScribeProposalChip } from '../../../../shared/components/ScribeProposalView/ScribeProposalChip';
import { ScribeProposalView } from '../../../../shared/components/ScribeProposalView';
import { useScribeProposal } from '../../../../shared/hooks/useScribeProposal';

type Props = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

export const AgentBriefPullRequestText = ({ sessionId, agentId }: Props) => {
  const snapshot = useScribeProposal({ sessionId, agentId });
  if (snapshot === null) {
    return null;
  }
  return (
    <Band
      inset="content"
      label="Pull request text"
      headingLevel={2}
      action={<ScribeProposalChip state={snapshot.state} />}
    >
      <ScribeProposalView
        proposal={snapshot.proposal}
        state={snapshot.state}
        canRetry={snapshot.canRetry}
        isCompact={false}
        hasHeader={false}
        onRetry={snapshot.retry}
      />
    </Band>
  );
};
