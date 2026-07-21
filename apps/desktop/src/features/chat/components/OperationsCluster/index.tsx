import { useMemo, useState } from 'react';
import { ChevronRight, Layers } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import type { TranscriptItem } from '../../utils/transcript-items';
import { TranscriptCard } from '../TranscriptCards';
import { MARKER_ACCENT } from '../marker-accents';
import { TranscriptShell } from '../TranscriptShell';

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
    if (item.kind === 'tool_call' && !item.ended) {
      return item;
    }
  }
  return null;
}

const accent = MARKER_ACCENT.operations;
const dangerAccent = MARKER_ACCENT.danger;
const successAccent = MARKER_ACCENT.success;

export const OperationsCluster = ({
  items,
  sessionId = null,
  agentId = null,
  workingDir = null,
  onRefreshAuth,
  onOpenDiff,
}: OperationsClusterProps) => {
  const [open, setOpen] = useState(false);
  const running = runningTool(items);
  const errorCount = items.reduce((n, i) => (i.kind === 'tool_call' && i.isError ? n + 1 : n), 0);
  const successCount = items.length - errorCount;
  const showError = !running && errorCount > 0;

  const summary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      const name =
        item.kind === 'tool_call' ? item.toolName : item.kind === 'file_edit' ? 'edit' : item.kind;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return [...counts.entries()].map(([name, count]) => `${count} ${name}`).join(' · ');
  }, [items]);

  const ariaLabel = `operations, ${items.length} ${items.length === 1 ? 'item' : 'items'}${
    running
      ? `, running ${running.toolName}`
      : showError
        ? `, ${successCount} succeeded, ${errorCount} failed`
        : ''
  }`;

  return (
    <div className="group">
      <TranscriptShell
        as="button"
        type="button"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
        tone={showError ? 'danger' : 'operations'}
        variant="leftBorder"
        className={cn(
          'relative flex w-full items-center gap-2 text-left text-xs motion-safe:transition-opacity group-hover:opacity-80',
          running != null && 'animate-border-pulse',
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
        <Layers size={11} aria-hidden className={cn('shrink-0', accent.icon)} />
        <span className={cn('font-medium', accent.text)}>operations</span>
        <span
          className={cn(
            'rounded-full px-1.5 text-2xs tabular-nums',
            accent.bg,
            'text-muted-foreground',
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
          </span>
        ) : showError ? (
          <span className="flex shrink-0 items-center gap-1.5 text-2xs tabular-nums">
            <span aria-hidden className="text-muted-foreground/40">
              ·
            </span>
            <span className={successAccent.text}>{successCount} success</span>
            <span aria-hidden className="text-muted-foreground/40">
              ·
            </span>
            <span className={dangerAccent.text}>{errorCount} failed</span>
          </span>
        ) : summary.length > 0 ? (
          <span className="truncate text-2xs text-muted-foreground/60">{summary}</span>
        ) : null}
      </TranscriptShell>
      {open ? (
        <TranscriptShell
          tone="operations"
          variant="leftBorder"
          nested
          className="ml-2 mt-0.5 flex min-w-0 flex-col gap-0.5"
        >
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
        </TranscriptShell>
      ) : null}
    </div>
  );
};
