import { cn } from '@kay-am/ui';
import type { TranscriptItem } from './transcript-items';

interface PermissionDecisionCardProps {
  readonly item: Extract<TranscriptItem, { kind: 'permission_decision' }>;
}

const DECISION_TONE: Record<'allow' | 'deny', string> = {
  allow: 'text-success',
  deny: 'text-danger',
};

export function PermissionDecisionCard({ item }: PermissionDecisionCardProps) {
  const timestamp = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(item.at));

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted px-2 py-1.5 text-xs">
      <span className="rounded bg-background px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        perm decision
      </span>
      <code className="font-mono text-foreground">{item.toolUseId}</code>
      <span className={cn('font-semibold', DECISION_TONE[item.decision])}>{item.decision}</span>
      {item.ruleId !== null ? (
        <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-secondary-foreground">
          {item.ruleId}
        </span>
      ) : null}
      <span className="ml-auto text-[10px] text-muted-foreground">{timestamp}</span>
    </div>
  );
}
