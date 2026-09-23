import { ListOrdered } from 'lucide-react';
import type { AgentId, SessionId } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useAppStore } from '../../../../store';

type Props = {
  readonly sessionId: SessionId;
  readonly containerAgentId: AgentId;
};

export const ClusterExecutionEligibilityNote = ({ sessionId, containerAgentId }: Props) => {
  const reason = useAppStore((state) => {
    const eligibility = (state.clusterExecutionEligibility?.[sessionId] ?? []).find(
      (candidate) => candidate.containerAgentId === containerAgentId,
    );
    return eligibility?.state === 'sequential' ? eligibility.reason : null;
  });
  if (reason === null) {
    return null;
  }
  return (
    <span
      data-testid={`cluster-sequential-${containerAgentId}`}
      title={reason}
      className="flex min-w-0 max-w-64 shrink items-center gap-1 rounded-md bg-muted/50 px-2 py-1 text-2xs text-muted-foreground"
    >
      <ListOrdered size={ICON_SIZE.row} aria-hidden className="shrink-0" />
      <span className="min-w-0 truncate">One at a time: {reason}</span>
    </span>
  );
};
