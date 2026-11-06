import { Check, X } from 'lucide-react';
import { ICON_SIZE, tintClasses } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import type { TranscriptItem } from '../../../chat/utils/transcript-items';
import { useIsStoppedBeforeAnswer } from '../../hooks/useIsStoppedBeforeAnswer';
import { decisionSentenceOf } from '../PermissionDecisionCard/decisionSentenceOf';
import { RetryButton } from '../PermissionDecisionCard/RetryButton';

type Props = {
  readonly item: Extract<TranscriptItem, { kind: 'permission_decision' }>;
  readonly sessionId: SessionId | null;
  readonly agentId: AgentId | null;
};

const warningText = tintClasses('warning').text;

export const PermissionRecordLine = ({ item, sessionId, agentId }: Props) => {
  const isStopped = useIsStoppedBeforeAnswer({ item, agentId });
  const Icon = item.decision === 'allow' ? Check : X;
  const sentence =
    item.scope === 'once'
      ? `${item.decision === 'allow' ? 'Allowed' : 'Denied'} ${item.subject ?? item.toolName}`
      : decisionSentenceOf({
          decision: item.decision,
          scope: item.scope,
          toolName: item.toolName,
          subject: item.subject,
        });
  return (
    <div className="flex min-w-0 flex-col gap-2 text-meta">
      <p
        data-permission-record={item.decision}
        className="flex min-w-0 items-center gap-2 text-faint-foreground"
      >
        <Icon size={ICON_SIZE.row} aria-hidden className="shrink-0" />
        <span className="min-w-0 truncate">
          {item.reason === undefined ? sentence : `${sentence}: ${item.reason}`}
        </span>
      </p>
      {isStopped && sessionId !== null && agentId !== null && (
        <div className="flex flex-wrap items-center gap-2">
          <span className={warningText}>Stopped before your answer.</span>
          <RetryButton
            sessionId={sessionId}
            agentId={agentId}
            toolName={item.toolName}
            toolUseId={item.toolUseId}
          />
        </div>
      )}
    </div>
  );
};
