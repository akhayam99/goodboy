import { useState } from 'react';
import { ChevronRight, Wrench } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { TranscriptItem } from '../../utils/transcript-items';
import { MARKER_ACCENT } from '../marker-accents';
import { StructuredData } from './StructuredData';

type Props = {
  readonly item: Extract<TranscriptItem, { kind: 'tool_call' }>;
};

export const ToolCallCard = ({ item }: Props) => {
  const [open, setOpen] = useState(false);
  const [rawMode, setRawMode] = useState(false);
  const running = !item.ended;

  const iconColor = item.isError
    ? MARKER_ACCENT.error.icon
    : running
      ? 'text-muted-foreground/60'
      : MARKER_ACCENT.operations.icon;

  return (
    <div className="group">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs motion-safe:transition-colors hover:bg-muted/60',
          item.isError && 'text-danger',
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
        <Wrench size={11} aria-hidden className={cn('shrink-0', iconColor)} />
        <span className="font-mono text-muted-foreground">{item.toolName}</span>
        {running ? (
          <span className="flex shrink-0 gap-0.5">
            <span className="h-1 w-1 motion-safe:animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:0ms]" />
            <span className="h-1 w-1 motion-safe:animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:150ms]" />
            <span className="h-1 w-1 motion-safe:animate-pulse rounded-full bg-muted-foreground/60 [animation-delay:300ms]" />
          </span>
        ) : item.isError ? (
          <span className="text-2xs uppercase tracking-wide text-danger">error</span>
        ) : null}
      </button>
      {open ? (
        <div className="ml-[1.125rem] mt-0.5 flex min-w-0 flex-col gap-1">
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
              <pre className="min-w-0 whitespace-pre-wrap break-words border-l-2 border-primary/30 p-1.5 font-mono text-xs text-muted-foreground">
                input: {JSON.stringify(item.input, null, 2)}
              </pre>
              {item.ended ? (
                <pre className="min-w-0 whitespace-pre-wrap break-words border-l-2 border-primary/30 p-1.5 font-mono text-xs text-muted-foreground">
                  output: {JSON.stringify(item.output, null, 2)}
                </pre>
              ) : null}
            </>
          ) : (
            <>
              <div className="border-l-2 border-primary/20 p-1.5 text-xs">
                <StructuredData data={item.input} label="input" />
              </div>
              {item.ended ? (
                <div
                  className={cn(
                    'border-l-2 p-1.5 text-xs',
                    item.isError ? 'border-danger/30' : 'border-success/30',
                  )}
                >
                  <StructuredData data={item.output} label="output" />
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
};
