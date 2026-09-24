import { memo, type ReactNode } from 'react';
import type { AgentId, ProviderRunId, SessionId } from '@goodboy/types';
import type { TranscriptItem } from '../../utils/transcript-items';
import { transcriptItemEqual } from '../../utils/transcriptItemEqual';
import { ArtifactBlockCard } from '../ArtifactBlockCard';
import { ArtifactCaptureNoticeCard } from '../ArtifactCaptureNoticeCard';
import { AuthRequiredCallout } from '../AuthRequiredCallout';
import { StrandedWriterLeaseCallout } from '../StrandedWriterLeaseCallout';
import { SkillInvocationCard } from '../SkillInvocationCard';
import { PhaseTransitionCard } from '../PhaseTransitionCard';
import { OrchestratorDecisionCard } from '../OrchestratorDecisionCard';
import { WorkflowKickoffCard } from '../WorkflowKickoffCard';
import { ResolverKickoffCard } from '../ResolverKickoffCard';
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
  readonly onRetryError?: (item: Extract<TranscriptItem, { kind: 'error' }>) => void;
  readonly retryingErrorRunId?: ProviderRunId | null;
};

const TranscriptCardImpl = ({
  item,
  sessionId = null,
  agentId = null,
  workingDir = null,
  onRefreshAuth,
  onOpenDiff,
  onRetryError,
  retryingErrorRunId = null,
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
          workingDir={workingDir}
        />
      );
    case 'assistant_text':
      return <AssistantText text={item.text} sessionId={sessionId} agentId={agentId} />;
    case 'artifact_block':
      return <ArtifactBlockCard item={item} sessionId={sessionId} agentId={agentId} />;
    case 'tool_call':
      return <ToolCallCard item={item} />;
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
    case 'error':
      return (
        <TranscriptErrorRow
          message={item.message}
          onRetry={
            item.retryable === true && onRetryError != null ? () => onRetryError(item) : undefined
          }
          isRetrying={
            item.runId != null && retryingErrorRunId != null && item.runId === retryingErrorRunId
          }
        />
      );
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
    case 'stranded_writer_lease':
      return (
        <StrandedWriterLeaseCallout
          holder={item.holder}
          resource={item.resource}
          waitedMs={item.waitedMs}
        />
      );
    case 'skill_invocation':
      return <SkillInvocationCard item={item} />;
    case 'step_transition':
      return <PhaseTransitionCard item={item} />;
    case 'orchestrator_decision':
      return <OrchestratorDecisionCard item={item} />;
    case 'workflow_kickoff':
      return <WorkflowKickoffCard item={item} />;
    case 'resolver_kickoff':
      return <ResolverKickoffCard item={item} sessionId={sessionId} />;
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
    prev.onRetryError === next.onRetryError &&
    prev.retryingErrorRunId === next.retryingErrorRunId,
);
