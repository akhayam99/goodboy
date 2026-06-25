import { cn } from '@goodboy/ui'
import type { AgentId, SessionId } from '@goodboy/types'
import type { TranscriptItem } from '../../../chat/utils/transcript-items'
import { formatCardTime } from '../../../chat/utils/format-card-time'

type Props = {
  readonly item: Extract<TranscriptItem, { kind: 'permission_decision' }>
  readonly sessionId: SessionId | null
  readonly agentId: AgentId | null
}

const DECISION_TONE: Record<'allow' | 'deny', string> = {
  allow: 'text-success',
  deny: 'text-danger',
}

export const PermissionDecisionCard = ({
  item,
  sessionId: _sessionId,
  agentId: _agentId,
}: Props) => {
  const timestamp = formatCardTime(item.at)

  return (
    <div className="rounded-md border border-border bg-muted px-2 py-1.5 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-background px-1.5 py-0.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
          perm decision
        </span>
        <code className="font-mono text-foreground">{item.toolUseId}</code>
        <span className={cn('font-semibold', DECISION_TONE[item.decision])}>{item.decision}</span>
        {item.ruleId !== null && (
          <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-2xs text-secondary-foreground">
            {item.ruleId}
          </span>
        )}
        <span className="ml-auto text-2xs text-muted-foreground">{timestamp}</span>
      </div>
    </div>
  )
}
