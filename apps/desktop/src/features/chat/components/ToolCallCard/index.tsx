import { useState, type ReactNode } from 'react';
import { Wrench } from 'lucide-react';
import { cn, tintClasses } from '@goodboy/ui';
import type { TranscriptItem } from '../../utils/transcript-items';
import { formatDuration } from '../../utils/format-duration';
import { useElapsedMs } from '../../hooks/useElapsedMs';
import { TranscriptDisclosure } from '../TranscriptDisclosure';
import { TranscriptRowHeader } from '../TranscriptRowHeader';
import { StructuredData } from './StructuredData';

type Props = {
  readonly item: Extract<TranscriptItem, { kind: 'tool_call' }>;
};

const dangerTint = tintClasses('danger');
const successTint = tintClasses('success');
const runningTint = tintClasses('info');

const Section = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex min-w-0 flex-col gap-1">
    <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
      {label}
    </span>
    {children}
  </div>
);

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
    <TranscriptDisclosure
      tone="neutral"
      open={open}
      bodyClassName="gap-2"
      header={
        <TranscriptRowHeader
          grouped
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
      }
    >
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setRawMode((value) => !value)}
          data-testid="raw-toggle"
          className="rounded-md px-1.5 py-0.5 text-2xs text-muted-foreground/60 hover:bg-muted/40 hover:text-foreground/80"
        >
          {rawMode ? 'structured' : 'raw json'}
        </button>
      </div>
      {rawMode ? (
        <>
          <Section label="input">
            <pre className="min-w-0 whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground">
              {JSON.stringify(item.input, null, 2)}
            </pre>
          </Section>
          {item.ended ? (
            <Section label="output">
              <pre className="min-w-0 whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground">
                {JSON.stringify(item.output, null, 2)}
              </pre>
            </Section>
          ) : null}
        </>
      ) : (
        <>
          <Section label="input">
            <div className="min-w-0 text-xs">
              <StructuredData data={item.input} label="input" />
            </div>
          </Section>
          {item.ended ? (
            <Section label="output">
              <div className="min-w-0 text-xs">
                <StructuredData data={item.output} label="output" />
              </div>
            </Section>
          ) : null}
        </>
      )}
    </TranscriptDisclosure>
  );
};
