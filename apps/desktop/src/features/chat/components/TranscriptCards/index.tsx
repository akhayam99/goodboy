import { memo } from 'react';
import { Divider } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import type { TranscriptItem } from '../../utils/transcript-items';
import { AuthRequiredCallout } from '../AuthRequiredCallout';
import { SkillInvocationCard } from '../SkillInvocationCard';
import { PhaseTransitionCard } from '../PhaseTransitionCard';
import { WorkflowKickoffCard } from '../WorkflowKickoffCard';
import { PermissionRequestCard } from '../../../../features/permissions/components/PermissionRequestCard';
import { PermissionDecisionCard } from '../../../../features/permissions/components/PermissionDecisionCard';
import { ToolCallCard } from '../ToolCallCard';
import { TranscriptShell } from '../TranscriptShell';
import { MARKER_ACCENT } from '../marker-accents';
import { AssistantText } from './AssistantText';
import { FileEditBlock } from './FileEditBlock';
import { UsageRow } from './UsageRow';
import { UserText } from './UserText';

const dangerAccent = MARKER_ACCENT.danger;

type TranscriptCardProps = {
  readonly item: TranscriptItem;
  readonly sessionId?: SessionId | null;
  readonly agentId?: AgentId | null;
  readonly workingDir?: string | null;
  readonly onRefreshAuth?: () => void;
  readonly onOpenDiff?: (filePath: string) => void;
};

function TranscriptCardImpl({
  item,
  sessionId = null,
  agentId = null,
  workingDir = null,
  onRefreshAuth,
  onOpenDiff,
}: TranscriptCardProps) {
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
      return <AssistantText text={item.text} sessionId={sessionId} />;
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
        <TranscriptShell tone="danger" variant="boxed" className={`text-sm ${dangerAccent.text}`}>
          {item.message}
        </TranscriptShell>
      );
    case 'auth_required':
      return (
        <AuthRequiredCallout
          providerId={item.providerId}
          identity={item.identity}
          onRefresh={onRefreshAuth ?? (() => undefined)}
        />
      );
    case 'skill_invocation':
      return <SkillInvocationCard item={item} />;
    case 'step_transition':
      return <PhaseTransitionCard item={item} />;
    case 'workflow_kickoff':
      return <WorkflowKickoffCard item={item} />;
    case 'oq_answer':
      return null;
    case 'done':
      return <Divider />;
    case 'permission_request':
      return <PermissionRequestCard item={item} sessionId={sessionId} agentId={agentId} />;
    case 'permission_decision':
      return <PermissionDecisionCard item={item} sessionId={sessionId} agentId={agentId} />;
  }
}

function itemEqual(a: TranscriptItem, b: TranscriptItem): boolean {
  if (a === b) {
    return true;
  }
  if (a.kind !== b.kind || a.key !== b.key) {
    return false;
  }
  if (a.kind === 'tool_call' && b.kind === 'tool_call') {
    return a.ended === b.ended && a.isError === b.isError && a.output === b.output;
  }
  if (a.kind === 'assistant_text' && b.kind === 'assistant_text') {
    return a.text === b.text;
  }
  return true;
}

export const TranscriptCard = memo(
  TranscriptCardImpl,
  (prev, next) =>
    itemEqual(prev.item, next.item) &&
    prev.sessionId === next.sessionId &&
    prev.agentId === next.agentId &&
    prev.workingDir === next.workingDir &&
    prev.onRefreshAuth === next.onRefreshAuth &&
    prev.onOpenDiff === next.onOpenDiff,
);
