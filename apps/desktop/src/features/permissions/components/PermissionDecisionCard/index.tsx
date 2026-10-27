import { tintClasses } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import type { TranscriptItem } from '../../../chat/utils/transcript-items';
import { formatClock } from '../../../../shared/utils/time/formatClock';
import { useAppStore } from '../../../../store';
import { TranscriptShell } from '../../../chat/components/TranscriptShell';
import { decisionSentenceOf } from './decisionSentenceOf';
import { RetryButton } from './RetryButton';

type Props = {
  readonly item: Extract<TranscriptItem, { kind: 'permission_decision' }>;
  readonly sessionId: SessionId | null;
  readonly agentId: AgentId | null;
};

const warningText = tintClasses('warning').text;

export const PermissionDecisionCard = ({ item, sessionId, agentId }: Props) => {
  const timestamp = formatClock({ at: item.at });
  const isRuleAllow =
    item.decision === 'allow' &&
    item.scope !== undefined &&
    item.scope !== 'once' &&
    item.scope !== 'deny';
  const isOnceAllow = item.decision === 'allow' && item.scope === 'once';
  const isWaitingForContinue = useAppStore((state) => {
    if (!isRuleAllow || agentId === null) {
      return false;
    }
    const kind = state.agentTurnState[agentId]?.kind;
    if (kind === 'running' || kind === 'starting') {
      return false;
    }
    const last = (state.transcripts[agentId] ?? []).at(-1);
    return last?.kind === 'permission_decision' && last.toolUseId === item.toolUseId;
  });
  const canContinue = isWaitingForContinue && sessionId !== null && agentId !== null;
  const sentence = decisionSentenceOf({
    decision: item.decision,
    scope: item.scope,
    toolName: item.toolName,
    subject: item.subject,
  });

  return (
    <TranscriptShell
      tone={canContinue ? 'warning' : 'neutral'}
      variant="boxed"
      className="flex flex-col gap-2 text-meta"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-foreground">{sentence}</span>
        {item.ruleId !== null && (
          <span className="rounded-md bg-fill px-2 py-0.5 font-mono text-chip text-muted-foreground">
            {item.ruleId}
          </span>
        )}
        <span className="ml-auto text-meta text-muted-foreground">{timestamp}</span>
      </div>
      {canContinue && (
        <div className="flex flex-wrap items-center gap-2">
          <span className={warningText}>Stopped before your answer.</span>
          <RetryButton sessionId={sessionId} agentId={agentId} toolName={item.toolName} />
        </div>
      )}
      {isOnceAllow && (
        <span className="text-muted-foreground">The agent is continuing on its own.</span>
      )}
    </TranscriptShell>
  );
};
