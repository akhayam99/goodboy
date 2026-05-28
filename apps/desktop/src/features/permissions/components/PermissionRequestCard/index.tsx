import { useState } from 'react';
import type { AgentId, SessionId } from '@goodboy/types';
import type { TranscriptItem } from '../../../chat/utils/transcript-items';
import { PermissionScopePicker } from '../PermissionScopePicker';
import { formatCardTime } from '../../../chat/utils/format-card-time';

interface Props {
  readonly item: Extract<TranscriptItem, { kind: 'permission_request' }>;
  readonly sessionId: SessionId | null;
  readonly agentId: AgentId | null;
}

export function PermissionRequestCard({ item, sessionId, agentId }: Props) {
  const [resolved, setResolved] = useState(false);

  const timestamp = formatCardTime(item.at);

  const showPicker = !resolved && sessionId !== null && agentId !== null;

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
          sessionId={sessionId}
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
