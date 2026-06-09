import { useState } from 'react';
import { AlertTriangle, ChevronRight, Layers } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import type { TranscriptItem } from '../../utils/transcript-items';
import { TranscriptCard } from '../TranscriptCards';

type OperationsClusterProps = {
  readonly items: ReadonlyArray<TranscriptItem>;
  readonly sessionId?: SessionId | null;
  readonly agentId?: AgentId | null;
  readonly workingDir?: string | null;
  readonly onRefreshAuth?: () => void;
  readonly onOpenDiff?: (filePath: string) => void;
};

function runningTool(
  items: ReadonlyArray<TranscriptItem>,
): Extract<TranscriptItem, { kind: 'tool_call' }> | null {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i]!;
    if (item.kind === 'tool_call' && !item.ended) return item;
  }
  return null;
}

export function OperationsCluster({
  items,
  sessionId = null,
  agentId = null,
  workingDir = null,
  onRefreshAuth,
  onOpenDiff,
}: OperationsClusterProps) {
  const [open, setOpen] = useState(false);
  const running = runningTool(items);
  const errorCount = items.reduce((n, i) => (i.kind === 'tool_call' && i.isError ? n + 1 : n), 0);
  const showError = !running && errorCount > 0;

  const ariaLabel = `operations, ${items.length} ${items.length === 1 ? 'item' : 'items'}${
    running ? `, running ${running.toolName}` : showError ? `, ${errorCount} failed` : ''
  }`;

  return (
    <div className="group">
      <button
        type="button"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs motion-safe:transition-colors hover:bg-muted/60',
          showError && 'text-danger',
        )}
      >
        <ChevronRight
          size={11}
          aria-hidden
          className={cn(
            'shrink-0 text-muted-foreground/60 motion-safe:transition-transform',
            open && 'rotate-90',
          )}
        />
        <Layers
          size={11}
          aria-hidden
          className={cn('shrink-0', showError ? 'text-danger' : 'text-muted-foreground')}
        />
        <span className={cn('font-medium', showError ? 'text-danger' : 'text-foreground/80')}>
          operations
        </span>
        <span
          className={cn(
            'rounded-full px-1.5 text-2xs tabular-nums',
            showError ? 'bg-danger/10 text-danger' : 'bg-muted text-muted-foreground',
          )}
        >
          {items.length}
        </span>
        {running ? (
          <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground/80">
            <span aria-hidden className="text-muted-foreground/40">
              ·
            </span>
            <span className="truncate font-mono">{running.toolName}</span>
            <span className="flex shrink-0 gap-0.5">
              <span className="h-1 w-1 animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:0ms]" />
              <span className="h-1 w-1 animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:150ms]" />
              <span className="h-1 w-1 animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:300ms]" />
            </span>
          </span>
        ) : showError ? (
          <span className="flex shrink-0 items-center gap-1 text-danger">
            <AlertTriangle size={10} aria-hidden />
            <span className="text-2xs uppercase tracking-wide">{errorCount} failed</span>
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="ml-2 mt-0.5 flex min-w-0 flex-col gap-0.5 border-l border-border-soft pl-3">
          {items.map((item) => (
            <TranscriptCard
              key={item.key}
              item={item}
              sessionId={sessionId}
              agentId={agentId}
              workingDir={workingDir}
              onRefreshAuth={onRefreshAuth}
              onOpenDiff={onOpenDiff}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
