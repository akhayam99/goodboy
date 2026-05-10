import { useState } from 'react';
import type { SessionId, TaskId } from '@kay-am/types';
import type { TranscriptItem } from './transcript-items';
import { PermissionScopePicker } from './PermissionScopePicker';

interface PermissionRequestCardProps {
  readonly item: Extract<TranscriptItem, { kind: 'permission_request' }>;
  readonly taskId: TaskId | null;
  readonly agentId: SessionId | null;
}

export function PermissionRequestCard({ item, taskId, agentId }: PermissionRequestCardProps) {
  const [resolved, setResolved] = useState(false);

  const timestamp = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(item.at));

  const showPicker = !resolved && taskId !== null && agentId !== null;

  return (
    <div className="rounded-md border border-border bg-muted px-2 py-1.5 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-background px-1.5 py-0.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
          perm request
        </span>
        <code className="font-mono text-foreground">{item.toolName}</code>
        {resolved ? (
          <span className="ml-auto text-2xs text-success">resolved</span>
        ) : (
          <span className="ml-auto text-2xs text-muted-foreground">{timestamp}</span>
        )}
      </div>
      {showPicker ? (
        <PermissionScopePicker
          taskId={taskId}
          agentId={agentId}
          toolUseId={item.toolUseId}
          toolName={item.toolName}
          runId={item.runId}
          onResolved={() => setResolved(true)}
        />
      ) : null}
    </div>
  );
}
