import { useState } from 'react';
import { Wrench } from 'lucide-react';
import { cn, tintClasses } from '@goodboy/ui';
import type { TranscriptItem } from '../../utils/transcript-items';
import { formatDuration } from '../../utils/format-duration';
import { useElapsedMs } from '../../hooks/useElapsedMs';
import { TranscriptRowHeader } from '../TranscriptRowHeader';
import { TranscriptShell } from '../TranscriptShell';
import { StructuredData } from './StructuredData';

type Props = {
  readonly item: Extract<TranscriptItem, { kind: 'tool_call' }>;
};

const operationsTint = tintClasses('operations');
const dangerTint = tintClasses('danger');
const successTint = tintClasses('success');
const runningTint = tintClasses('warning');

export const ToolCallCard = ({ item }: Props) => {
  const [open, setOpen] = useState(false);
  const [rawMode, setRawMode] = useState(false);
  const running = !item.ended;
  const elapsedMs = useElapsedMs({ running });
  const duration = elapsedMs != null ? formatDuration({ durationMs: elapsedMs }) : null;

  const stateIcon = item.isError
    ? dangerTint.icon
    : running
      ? cn(runningTint.icon, 'motion-safe:animate-pulse')
      : successTint.icon;

  return (
    <div className="flex flex-col gap-0.5">
      <TranscriptRowHeader
        tone="neutral"
        icon={
          <Wrench
            size={12}
            aria-hidden
            data-testid="tool-state-icon"
            className={cn('shrink-0', stateIcon)}
          />
        }
        eyebrow="tool"
        open={open}
        onToggle={() => setOpen((value) => !value)}
        preview={
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate font-mono text-muted-foreground">{item.toolName}</span>
            {!running && item.isError && (
              <span className={cn('shrink-0 text-2xs uppercase tracking-wide', dangerTint.text)}>
                error
              </span>
            )}
          </span>
        }
        meta={duration ?? undefined}
      />
      {open ? (
        <div className="flex min-w-0 flex-col gap-1 pl-6">
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => setRawMode((value) => !value)}
              data-testid="raw-toggle"
              className="rounded px-1.5 py-0.5 text-2xs text-muted-foreground/60 hover:bg-muted/40 hover:text-foreground/80"
            >
              {rawMode ? 'structured' : 'raw json'}
            </button>
          </div>
          {rawMode ? (
            <>
              <TranscriptShell
                tone="operations"
                variant="leftBorder"
                nested
                className={cn('min-w-0 rounded-md', operationsTint.bgSoft)}
              >
                <pre className="min-w-0 whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground">
                  input: {JSON.stringify(item.input, null, 2)}
                </pre>
              </TranscriptShell>
              {item.ended ? (
                <TranscriptShell
                  tone={item.isError ? 'danger' : 'success'}
                  variant="leftBorder"
                  nested
                  className={cn(
                    'min-w-0 rounded-md',
                    item.isError ? dangerTint.bgSoft : successTint.bgSoft,
                  )}
                >
                  <pre className="min-w-0 whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground">
                    output: {JSON.stringify(item.output, null, 2)}
                  </pre>
                </TranscriptShell>
              ) : null}
            </>
          ) : (
            <>
              <TranscriptShell
                tone="operations"
                variant="leftBorder"
                nested
                className={cn('rounded-md text-xs', operationsTint.bgSoft)}
              >
                <StructuredData data={item.input} label="input" />
              </TranscriptShell>
              {item.ended ? (
                <TranscriptShell
                  tone={item.isError ? 'danger' : 'success'}
                  variant="leftBorder"
                  nested
                  className={cn(
                    'rounded-md text-xs',
                    item.isError ? dangerTint.bgSoft : successTint.bgSoft,
                  )}
                >
                  <StructuredData data={item.output} label="output" />
                </TranscriptShell>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
};
