import { useState } from 'react';
import { Wrench } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { TranscriptItem } from '../../utils/transcript-items';
import { MARKER_ACCENT } from '../marker-accents';
import { TranscriptChevron } from '../TranscriptChevron';
import { TRANSCRIPT_ROW_HOVER } from '../transcript-row-hover';
import { TranscriptShell } from '../TranscriptShell';
import { StructuredData } from './StructuredData';

type Props = {
  readonly item: Extract<TranscriptItem, { kind: 'tool_call' }>;
};

export const ToolCallCard = ({ item }: Props) => {
  const [open, setOpen] = useState(false);
  const [rawMode, setRawMode] = useState(false);
  const running = !item.ended;

  const stateIcon = item.isError
    ? MARKER_ACCENT.danger.icon
    : running
      ? cn(MARKER_ACCENT.warning.icon, 'motion-safe:animate-pulse')
      : MARKER_ACCENT.success.icon;

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs',
          TRANSCRIPT_ROW_HOVER,
          item.isError && 'text-danger',
        )}
      >
        <TranscriptChevron open={open} />
        <Wrench
          size={11}
          aria-hidden
          data-testid="tool-state-icon"
          className={cn('shrink-0', stateIcon)}
        />
        <span className="font-mono text-muted-foreground">{item.toolName}</span>
        {running ? null : item.isError ? (
          <span className="text-2xs uppercase tracking-wide text-danger">error</span>
        ) : null}
      </button>
      {open ? (
        <div className="ml-[1.125rem] flex min-w-0 flex-col gap-1">
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => setRawMode((v) => !v)}
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
                className={cn('min-w-0 rounded-md', MARKER_ACCENT.operations.bgSoft)}
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
                    item.isError ? MARKER_ACCENT.danger.bgSoft : MARKER_ACCENT.success.bgSoft,
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
                className={cn('rounded-md text-xs', MARKER_ACCENT.operations.bgSoft)}
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
                    item.isError ? MARKER_ACCENT.danger.bgSoft : MARKER_ACCENT.success.bgSoft,
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
