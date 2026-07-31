import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { tintClasses } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import type { TranscriptItem } from '../../../chat/utils/transcript-items';
import { PermissionScopePicker } from '../PermissionScopePicker';
import { formatCardTime } from '../../../chat/utils/format-card-time';
import { TranscriptShell } from '../../../chat/components/TranscriptShell';
import { formatRequestInput } from './formatRequestInput';

const warningTint = tintClasses('warning');
const resolvedTint = tintClasses('success');

type Props = {
  readonly item: Extract<TranscriptItem, { kind: 'permission_request' }>;
  readonly sessionId: SessionId | null;
  readonly agentId: AgentId | null;
};

export const PermissionRequestCard = ({ item, sessionId, agentId }: Props) => {
  const [resolved, setResolved] = useState(false);

  const timestamp = formatCardTime(item.at);
  const inputPreview = formatRequestInput({ input: item.input });

  const showPicker = !resolved && sessionId !== null && agentId !== null;

  return (
    <TranscriptShell
      tone="warning"
      variant="boxed"
      emphasis
      className="flex flex-col gap-2 text-xs"
    >
      <div className="flex flex-wrap items-center gap-2">
        <ShieldAlert size={14} aria-hidden className={warningTint.icon} />
        <span className="rounded-md bg-background px-1.5 py-0.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
          approval needed
        </span>
        <code className="font-mono text-foreground">{item.toolName}</code>
        {resolved ? (
          <span className={`ml-auto text-2xs ${resolvedTint.text}`}>resolved</span>
        ) : (
          <span className="ml-auto text-2xs text-muted-foreground">{timestamp}</span>
        )}
      </div>
      <span className="text-muted-foreground">
        the agent was blocked on this tool and stopped without running it. pick a scope to allow it,
        or deny.
      </span>
      {inputPreview !== null && (
        <pre className="min-w-0 whitespace-pre-wrap break-words rounded-md bg-background/60 px-2 py-1 font-mono text-2xs text-muted-foreground">
          {inputPreview}
        </pre>
      )}
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
    </TranscriptShell>
  );
};
