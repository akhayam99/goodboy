import { REVIEW_SOURCE_CAPABILITIES, REVIEW_SOURCE_LABEL } from '@goodboy/core';
import type { AgentId, PullRequestHost, SessionId } from '@goodboy/types';
import type { FixRunReady } from '../../fixRunReady';
import { FixRunChecks } from './FixRunChecks';
import { FixRunReadyBanner } from './FixRunReadyBanner';

type Props = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly ready: FixRunReady;
  readonly sourceKind: PullRequestHost | null;
  readonly isBusy: boolean;
  readonly onApply: () => void;
};

export const FixRunGroupHeader = ({
  sessionId,
  agentId,
  ready,
  sourceKind,
  isBusy,
  onApply,
}: Props) => {
  const kind = sourceKind ?? 'github';
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <FixRunReadyBanner
        ready={ready}
        provider={REVIEW_SOURCE_LABEL[kind]}
        canResolve={REVIEW_SOURCE_CAPABILITIES[kind].canResolve}
        isBusy={isBusy}
        onApply={onApply}
      />
      <FixRunChecks sessionId={sessionId} agentId={agentId} />
    </div>
  );
};
