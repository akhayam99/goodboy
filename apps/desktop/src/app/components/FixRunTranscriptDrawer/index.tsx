import { useEffect } from 'react';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { AgentTranscriptDrawer } from '../../../features/chat/components/AgentTranscriptDrawer';
import { useResolverBrief } from '../../../features/resolve/hooks/useResolverBrief';
import { fixRunAskingOf } from '../../../features/resolve/fixRunAsking';
import { fixRunStatusOf } from '../../../features/resolve/fixRunStatus';
import { useReviewEntries } from '../../../features/resolve/components/ReviewFlow/useReviewEntries';
import { FIX_RUN_COPY } from '../../../features/resolve/reviewFlowCopy';
import { FixRunLead } from '../../../features/resolve/components/FixRunSummary/FixRunLead';
import { TranscriptUsage } from './TranscriptUsage';

type Props = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly onClose: () => void;
};

export const FixRunTranscriptDrawer = ({ sessionId, agentId, onClose }: Props) => {
  const brief = useResolverBrief({ sessionId, agentId });
  const loadResolveSession = useAppStore((state) => state.loadResolveSession);
  const status = useAppStore((state) =>
    fixRunStatusOf({
      attempts: state.sessionResolveAttempts?.[sessionId] ?? [],
      agentId,
      turnKind: state.agentTurnState[agentId]?.kind ?? null,
    }),
  );
  const { entries } = useReviewEntries({ sessionId, scope: 'all' });

  useEffect(() => {
    void loadResolveSession({ sessionId });
  }, [loadResolveSession, sessionId]);

  const usage = <TranscriptUsage sessionId={sessionId} agentId={agentId} />;

  if (brief === null) {
    return (
      <AgentTranscriptDrawer
        sessionId={sessionId}
        agentId={agentId}
        detail={usage}
        onClose={onClose}
      />
    );
  }

  const asking = fixRunAskingOf({ entries, batchThreadIds: brief.batchThreadIds });

  return (
    <AgentTranscriptDrawer
      sessionId={sessionId}
      agentId={agentId}
      detail={usage}
      lead={<FixRunLead sessionId={sessionId} agentId={agentId} />}
      isLeadPreferred={status === 'ended' || asking.length > 0}
      leadAlertCount={asking.length}
      briefLabel={FIX_RUN_COPY.briefCard({
        count: brief.batchThreadIds.length,
        prNumber: brief.attempt.prNumber,
      })}
      onClose={onClose}
    />
  );
};
