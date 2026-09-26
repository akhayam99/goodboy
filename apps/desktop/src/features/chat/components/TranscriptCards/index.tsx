import type { RetryRunParams } from '../../retryRun';
import { memo, type ReactNode } from 'react';
import type { AgentId, ProviderRunId, SessionId } from '@goodboy/types';
import type { TranscriptItem } from '../../utils/transcript-items';
import { transcriptItemEqual } from '../../utils/transcriptItemEqual';
import type { PermissionState } from '../../utils/toolStatus';
import { ArtifactBlockCard } from '../ArtifactBlockCard';
import { ArtifactCaptureNoticeCard } from '../ArtifactCaptureNoticeCard';
import { AuthRequiredCallout } from '../AuthRequiredCallout';
import { CliTooOldNotice } from '../CliTooOldNotice';
import { SkillInvocationCard } from '../SkillInvocationCard';
import { PhaseTransitionCard } from '../PhaseTransitionCard';
import { OrchestratorDecisionCard } from '../OrchestratorDecisionCard';
import { HandoffBlock } from '../HandoffBlock';
import { PermissionRequestCard } from '../../../../features/permissions/components/PermissionRequestCard';
import { PermissionDecisionCard } from '../../../../features/permissions/components/PermissionDecisionCard';
import { ToolCallCard } from '../ToolCallCard';
import { AssistantText } from './AssistantText';
import { DecisionNoteRow } from './DecisionNoteRow';
import { TranscriptErrorRow } from './TranscriptErrorRow';
import { FileEditBlock } from './FileEditBlock';
import { UsageRow } from './UsageRow';
import { UserText } from './UserText';

type TranscriptCardProps = {
  readonly item: TranscriptItem;
  readonly sessionId?: SessionId | null;
  readonly agentId?: AgentId | null;
  readonly workingDir?: string | null;
  readonly onRefreshAuth?: () => void;
  readonly onOpenDiff?: (filePath: string) => void;
  readonly onRetryRun?: (params: RetryRunParams) => void;
  readonly retryingRunId?: ProviderRunId | null;
  readonly activeRunId?: ProviderRunId | null;
  readonly permission?: PermissionState;
};

const TranscriptCardImpl = ({
  item,
  sessionId = null,
  agentId = null,
  workingDir = null,
  onRefreshAuth,
  onOpenDiff,
  onRetryRun,
  retryingRunId = null,
  activeRunId,
  permission,
}: TranscriptCardProps): ReactNode => {
  switch (item.kind) {
    case 'user_text':
      return (
        <UserText
          text={item.text}
          at={item.at}
          attachments={item.attachments}
          provider={item.provider}
          model={item.model}
          sentVia={item.sentVia}
          workingDir={workingDir}
        />
      );
    case 'handoff':
      return (
        <HandoffBlock item={item} sessionId={sessionId} agentId={agentId} workingDir={workingDir} />
      );
    case 'assistant_text':
      return <AssistantText text={item.text} sessionId={sessionId} agentId={agentId} />;
    case 'artifact_block':
      return <ArtifactBlockCard item={item} sessionId={sessionId} agentId={agentId} />;
    case 'tool_call':
      return <ToolCallCard item={item} activeRunId={activeRunId} permission={permission} />;
    case 'file_edit':
      return (
        <FileEditBlock
          path={item.path}
          editType={item.editType}
          workingDir={workingDir}
          onOpenDiff={onOpenDiff}
        />
      );
    case 'usage':
      return <UsageRow usage={item.usage} />;
    case 'error': {
      const errorRunId = item.runId;
      return (
        <TranscriptErrorRow
          message={item.message}
          onRetry={
            item.retryable === true && errorRunId != null && onRetryRun != null
              ? () => onRetryRun({ runId: errorRunId, model: null })
              : undefined
          }
          isRetrying={item.runId != null && retryingRunId != null && item.runId === retryingRunId}
        />
      );
    }
    case 'decision_note':
      return <DecisionNoteRow message={item.message} />;
    case 'artifact_capture_failed':
      return <ArtifactCaptureNoticeCard item={item} sessionId={sessionId} agentId={agentId} />;
    case 'auth_required':
      return (
        <AuthRequiredCallout
          providerId={item.providerId}
          identity={item.identity}
          onRefresh={onRefreshAuth ?? (() => undefined)}
        />
      );
    case 'cli_too_old':
      return (
        <CliTooOldNotice
          payload={item.payload}
          runId={item.runId ?? null}
          onRetryRun={onRetryRun}
          isRetrying={item.runId != null && retryingRunId === item.runId}
        />
      );
    case 'skill_invocation':
      return <SkillInvocationCard item={item} />;
    case 'step_transition':
      return <PhaseTransitionCard item={item} />;
    case 'orchestrator_decision':
      return <OrchestratorDecisionCard item={item} />;
    case 'oq_answer':
      return null;
    case 'done':
      return null;
    case 'permission_request':
      return <PermissionRequestCard item={item} sessionId={sessionId} agentId={agentId} />;
    case 'permission_decision':
      return <PermissionDecisionCard item={item} sessionId={sessionId} agentId={agentId} />;
    default: {
      const exhaustive: never = item;
      return exhaustive;
    }
  }
};

export const TranscriptCard = memo(
  TranscriptCardImpl,
  (prev, next) =>
    transcriptItemEqual({ previous: prev.item, next: next.item }) &&
    prev.sessionId === next.sessionId &&
    prev.agentId === next.agentId &&
    prev.workingDir === next.workingDir &&
    prev.onRefreshAuth === next.onRefreshAuth &&
    prev.onOpenDiff === next.onOpenDiff &&
    prev.onRetryRun === next.onRetryRun &&
    prev.retryingRunId === next.retryingRunId &&
    prev.activeRunId === next.activeRunId &&
    prev.permission?.requested === next.permission?.requested &&
    prev.permission?.decision === next.permission?.decision,
);
