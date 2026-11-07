import type { AgentId, ProviderRunId, SessionId } from '@goodboy/types';
import type { ConversationRow } from '../../utils/conversationRows';
import type { OpenTranscriptAt } from '../../openTranscriptAt';
import type { RetryRunParams } from '../../retryRun';
import { OperationsCluster } from '../OperationsCluster';
import { PlanChecklist } from '../PlanChecklist';
import { TurnSummaryLine } from '../TurnSummaryLine';

type Props = {
  readonly row: Exclude<ConversationRow, { kind: 'item' }>;
  readonly turn: number;
  readonly onOpenTranscript?: OpenTranscriptAt;
  readonly isStepsOnly: boolean;
  readonly sessionId: SessionId;
  readonly agentId: AgentId | null;
  readonly workingDir: string | null;
  readonly onRefreshAuth: () => void;
  readonly onOpenDiff: (filePath: string) => void;
  readonly onRetryRun: (params: RetryRunParams) => void;
  readonly retryingRunId: ProviderRunId | null;
  readonly activeRunId?: ProviderRunId | null;
};

export const TranscriptSteps = ({
  row,
  turn,
  onOpenTranscript,
  isStepsOnly,
  sessionId,
  agentId,
  workingDir,
  onRefreshAuth,
  onOpenDiff,
  onRetryRun,
  retryingRunId,
  activeRunId,
}: Props) => {
  if (row.kind === 'summary') {
    return (
      <TurnSummaryLine
        steps={row.steps}
        turn={turn}
        {...(onOpenTranscript !== undefined && { onOpenTranscript })}
      />
    );
  }
  if (row.kind === 'plan') {
    return <PlanChecklist checklist={row.checklist} isLive={activeRunId != null} />;
  }
  return (
    <OperationsCluster
      items={row.items}
      isInitiallyOpen={isStepsOnly}
      hasAsks={!isStepsOnly}
      sessionId={sessionId}
      agentId={agentId}
      workingDir={workingDir}
      onRefreshAuth={onRefreshAuth}
      onOpenDiff={onOpenDiff}
      onRetryRun={onRetryRun}
      retryingRunId={retryingRunId}
      activeRunId={activeRunId}
    />
  );
};
