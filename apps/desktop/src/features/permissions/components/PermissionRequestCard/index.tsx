import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import type { AgentId, SessionId } from '@goodboy/types';
import type { TranscriptItem } from '../../../chat/utils/transcript-items';
import { PermissionScopePicker } from '../PermissionScopePicker';
import { formatCardTime } from '../../../chat/utils/format-card-time';
import { TranscriptShell } from '../../../chat/components/TranscriptShell';
import { MARKER_ACCENT } from '../../../chat/components/marker-accents';
import { formatRequestInput } from './formatRequestInput';

const warningAccent = MARKER_ACCENT.warning;
const resolvedAccent = MARKER_ACCENT.success;

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
    <TranscriptShell tone="warning" variant="boxed" className="flex flex-col gap-1.5 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <ShieldAlert size={11} aria-hidden className={warningAccent.icon} />
        <span className="rounded bg-background px-1.5 py-0.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
          approval needed
        </span>
        <code className="font-mono text-foreground">{item.toolName}</code>
        {resolved ? (
          <span className={`ml-auto text-2xs ${resolvedAccent.text}`}>resolved</span>
        ) : (
          <span className="ml-auto text-2xs text-muted-foreground">{timestamp}</span>
        )}
      </div>
      <span className="text-muted-foreground">
        the agent was blocked on this tool and stopped without running it. pick a scope to allow it,
        or deny.
      </span>
      {inputPreview !== null && (
        <pre className="min-w-0 whitespace-pre-wrap break-words rounded bg-background/60 px-2 py-1 font-mono text-2xs text-muted-foreground">
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
