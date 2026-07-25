import { cn } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import type { TranscriptItem } from '../../../chat/utils/transcript-items';
import { formatCardTime } from '../../../chat/utils/format-card-time';
import { TranscriptShell } from '../../../chat/components/TranscriptShell';
import { MARKER_ACCENT } from '../../../chat/components/marker-accents';
import { RetryButton } from './RetryButton';

type Props = {
  readonly item: Extract<TranscriptItem, { kind: 'permission_decision' }>;
  readonly sessionId: SessionId | null;
  readonly agentId: AgentId | null;
};

const DECISION_TONE: Record<'allow' | 'deny', string> = {
  allow: MARKER_ACCENT.success.text,
  deny: MARKER_ACCENT.danger.text,
};

export const PermissionDecisionCard = ({ item, sessionId, agentId }: Props) => {
  const timestamp = formatCardTime(item.at);
  const isRetryableScope = item.scope !== undefined && item.scope !== 'once';
  const canRetry =
    item.decision === 'allow' && isRetryableScope && sessionId !== null && agentId !== null;
  const isOnceAllow = item.decision === 'allow' && item.scope === 'once';

  return (
    <TranscriptShell tone="neutral" variant="boxed" className="flex flex-col gap-1.5 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-background px-1.5 py-0.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
          perm decision
        </span>
        <code className="font-mono text-foreground">{item.toolName}</code>
        <span className={cn('font-semibold', DECISION_TONE[item.decision])}>{item.decision}</span>
        {item.ruleId !== null && (
          <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-2xs text-secondary-foreground">
            {item.ruleId}
          </span>
        )}
        <span className="ml-auto text-2xs text-muted-foreground">{timestamp}</span>
      </div>
      {canRetry && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">
            the agent stopped when it was blocked, so it needs a new turn to use this rule.
          </span>
          <RetryButton sessionId={sessionId} agentId={agentId} toolName={item.toolName} />
        </div>
      )}
      {isOnceAllow && (
        <span className="text-muted-foreground">
          an approval for one use cannot carry into a new run: approve for the session or wider to
          let the agent retry.
        </span>
      )}
    </TranscriptShell>
  );
};
