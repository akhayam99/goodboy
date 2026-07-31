import { useMemo, useState } from 'react';
import { Layers } from 'lucide-react';
import { cn, tintClasses } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import type { TranscriptItem } from '../../utils/transcript-items';
import { formatDuration } from '../../utils/format-duration';
import { useElapsedMs } from '../../hooks/useElapsedMs';
import { TranscriptCard } from '../TranscriptCards';
import { TranscriptRowHeader } from '../TranscriptRowHeader';
import { TranscriptShell } from '../TranscriptShell';

type Props = {
  readonly items: ReadonlyArray<TranscriptItem>;
  readonly sessionId?: SessionId | null;
  readonly agentId?: AgentId | null;
  readonly workingDir?: string | null;
  readonly onRefreshAuth?: () => void;
  readonly onOpenDiff?: (filePath: string) => void;
};

const runningTool = (
  items: ReadonlyArray<TranscriptItem>,
): Extract<TranscriptItem, { kind: 'tool_call' }> | null => {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i]!;
    if (item.kind === 'tool_call' && !item.ended) {
      return item;
    }
  }
  return null;
};

const operationsTint = tintClasses('operations');
const dangerTint = tintClasses('danger');
const successTint = tintClasses('success');
const runningTint = tintClasses('warning');

export const OperationsCluster = ({
  items,
  sessionId = null,
  agentId = null,
  workingDir = null,
  onRefreshAuth,
  onOpenDiff,
}: Props) => {
  const [open, setOpen] = useState(false);
  const running = runningTool(items);
  const elapsedMs = useElapsedMs({ running: running != null });
  const errorCount = items.reduce((n, i) => (i.kind === 'tool_call' && i.isError ? n + 1 : n), 0);
  const successCount = items.length - errorCount;
  const showError = running == null && errorCount > 0;
  const stateIcon =
    running != null
      ? cn(runningTint.icon, 'motion-safe:animate-pulse')
      : showError
        ? dangerTint.icon
        : successTint.icon;

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
    running != null
      ? `, running ${running.toolName}`
      : showError
        ? `, ${successCount} succeeded, ${errorCount} failed`
        : ''
  }`;

  const duration = elapsedMs != null ? formatDuration({ durationMs: elapsedMs }) : null;

  return (
    <div className="flex flex-col gap-0.5">
      <TranscriptRowHeader
        tone="operations"
        icon={
          <Layers
            size={12}
            aria-hidden
            data-testid="operations-state-icon"
            className={cn('shrink-0', stateIcon)}
          />
        }
        eyebrow="operations"
        open={open}
        onToggle={() => setOpen((value) => !value)}
        aria-label={ariaLabel}
        badge={
          <span
            className={cn(
              'shrink-0 rounded-full px-1.5 text-2xs tabular-nums text-muted-foreground',
              operationsTint.bg,
            )}
          >
            {items.length}
          </span>
        }
        preview={
          running != null ? (
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate font-mono">{running.toolName}</span>
              {duration != null && (
                <span className="shrink-0 font-mono tabular-nums text-muted-foreground/70">
                  {duration}
                </span>
              )}
            </span>
          ) : showError ? (
            <span className="flex items-center gap-1.5 text-2xs tabular-nums">
              <span className={successTint.text}>{successCount} success</span>
              <span aria-hidden className="text-muted-foreground/40">
                ·
              </span>
              <span className={dangerTint.text}>{errorCount} failed</span>
            </span>
          ) : summary.length > 0 ? (
            <span className="truncate text-2xs text-muted-foreground/60">{summary}</span>
          ) : undefined
        }
        meta={running == null && duration != null ? duration : undefined}
      />
      {open ? (
        <TranscriptShell
          tone="operations"
          variant="leftBorder"
          nested
          className="flex min-w-0 flex-col gap-0.5 pl-6"
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
