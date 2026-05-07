import type { TranscriptItem } from './transcript-items';

interface PermissionRequestCardProps {
  readonly item: Extract<TranscriptItem, { kind: 'permission_request' }>;
}

export function PermissionRequestCard({ item }: PermissionRequestCardProps) {
  const timestamp = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(item.at));

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted px-2 py-1.5 text-xs">
      <span className="rounded bg-background px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        perm request
      </span>
      <code className="font-mono text-foreground">{item.toolName}</code>
      <span className="ml-auto text-[10px] text-muted-foreground">{timestamp}</span>
    </div>
  );
}
