import { useState, type ReactNode } from 'react';
import { ChevronRight, Rocket } from 'lucide-react';
import { Markdown, cn } from '@goodboy/ui';
import type { TranscriptItem } from '../../utils/transcript-items';
import { formatCardTime } from '../../utils/format-card-time';
import { MARKER_ACCENT } from '../marker-accents';
import { TranscriptShell } from '../TranscriptShell';

const accent = MARKER_ACCENT.primary;

type Props = {
  readonly item: Extract<TranscriptItem, { kind: 'workflow_kickoff' }>;
};

const Section = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex flex-col gap-1">
    <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
      {label}
    </span>
    {children}
  </div>
);

export const WorkflowKickoffCard = ({ item }: Props) => {
  const [open, setOpen] = useState(false);
  const timestamp = formatCardTime(item.at);
  const preview = item.parsed ? item.goal : '';

  return (
    <div>
      <TranscriptShell
        as="button"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        tone="primary"
        variant="leftBorder"
        className="group flex w-full items-center gap-2 text-left motion-safe:transition-opacity hover:opacity-80"
      >
        <ChevronRight
          size={11}
          aria-hidden
          className={cn(
            'shrink-0 opacity-50 motion-safe:transition-transform',
            accent.icon,
            open && 'rotate-90',
          )}
        />
        <Rocket size={11} aria-hidden className={cn('shrink-0', accent.icon)} />
        <span
          className={cn(
            'shrink-0 text-2xs font-medium uppercase tracking-wide opacity-80',
            accent.text,
          )}
        >
          workflow start
        </span>
        {preview.length > 0 ? (
          <span className="min-w-0 flex-1 truncate text-xs text-foreground/55">{preview}</span>
        ) : (
          <span className="flex-1" />
        )}
        <span className="shrink-0 font-mono text-2xs text-muted-foreground">{timestamp}</span>
      </TranscriptShell>

      {open ? (
        <TranscriptShell
          tone="primary"
          variant="leftBorder"
          nested
          className="ml-2 flex flex-col gap-2.5"
        >
          {item.parsed ? (
            <>
              {item.goal.length > 0 ? (
                <Section label="goal">
                  <div className="overflow-x-auto text-xs text-foreground/85">
                    <Markdown text={item.goal} />
                  </div>
                </Section>
              ) : null}
              {item.instructions.length > 0 ? (
                <Section label="what to do">
                  <div className="overflow-x-auto text-xs text-foreground">
                    <Markdown text={item.instructions} />
                  </div>
                </Section>
              ) : null}
              {item.marker.length > 0 ? (
                <Section label="marker to emit">
                  <div className="overflow-x-auto text-xs text-foreground/60">
                    <Markdown text={item.marker} />
                  </div>
                </Section>
              ) : null}
            </>
          ) : (
            <div className="overflow-x-auto text-xs text-foreground/85">
              <Markdown text={item.raw} />
            </div>
          )}
        </TranscriptShell>
      ) : null}
    </div>
  );
};
