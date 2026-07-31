import { useState, type ReactNode } from 'react';
import { Rocket } from 'lucide-react';
import { Markdown } from '@goodboy/ui';
import type { TranscriptItem } from '../../utils/transcript-items';
import { formatCardTime } from '../../utils/format-card-time';
import { TranscriptRowHeader } from '../TranscriptRowHeader';
import { TranscriptShell } from '../TranscriptShell';

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
  const goal = item.parsed ? item.goal : '';
  const hasGoal = goal.length > 0;
  const hasDetails = item.parsed
    ? item.instructions.length > 0 || item.marker.length > 0
    : item.raw.length > 0;

  return (
    <div className="flex flex-col gap-0.5">
      <TranscriptRowHeader
        tone="primary"
        icon={<Rocket size={12} aria-hidden />}
        eyebrow="workflow start"
        meta={formatCardTime(item.at)}
        open={open}
        onToggle={hasDetails ? () => setOpen((value) => !value) : undefined}
      />

      {hasGoal ? (
        <TranscriptShell
          tone="primary"
          variant="leftBorder"
          nested
          className="flex flex-col gap-2 pl-6"
        >
          <Section label="goal">
            <div className="overflow-x-auto text-sm leading-relaxed text-foreground">
              <Markdown text={goal} />
            </div>
          </Section>
        </TranscriptShell>
      ) : null}

      {open && hasDetails ? (
        <TranscriptShell
          tone="primary"
          variant="leftBorder"
          nested
          className="flex flex-col gap-2 pl-6"
        >
          {item.parsed ? (
            <>
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
