import { useState } from 'react';
import { Rocket } from 'lucide-react';
import { Markdown } from '@goodboy/ui';
import type { TranscriptItem } from '../../utils/transcript-items';
import { codeFenceMarkers } from '../../utils/codeFenceMarkers';
import { formatCardTime } from '../../utils/format-card-time';
import { TranscriptDisclosure } from '../TranscriptDisclosure';
import { TranscriptRowHeader } from '../TranscriptRowHeader';
import { Section } from './Section';

type Props = {
  readonly item: Extract<TranscriptItem, { kind: 'workflow_kickoff' }>;
};

export const WorkflowKickoffCard = ({ item }: Props) => {
  const [open, setOpen] = useState(false);
  const goal = item.parsed ? item.goal : '';
  const hasGoal = goal.length > 0;
  const hasBody = item.parsed
    ? hasGoal || item.instructions.length > 0 || item.marker.length > 0
    : item.raw.length > 0;

  return (
    <TranscriptDisclosure
      tone="neutral"
      open={open && hasBody}
      bodyClassName="gap-2"
      header={
        <TranscriptRowHeader
          grouped
          tone="neutral"
          icon={<Rocket size={12} aria-hidden />}
          eyebrow="workflow start"
          preview={hasGoal ? goal : undefined}
          meta={formatCardTime(item.at)}
          open={open}
          onToggle={hasBody ? () => setOpen((value) => !value) : undefined}
        />
      }
    >
      {item.parsed ? (
        <>
          {hasGoal ? (
            <Section label="goal">
              <div className="overflow-x-auto text-sm leading-relaxed text-foreground">
                <Markdown text={goal} />
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
                <Markdown text={codeFenceMarkers({ text: item.marker })} />
              </div>
            </Section>
          ) : null}
        </>
      ) : (
        <div className="overflow-x-auto text-xs text-foreground/85">
          <Markdown text={codeFenceMarkers({ text: item.raw })} />
        </div>
      )}
    </TranscriptDisclosure>
  );
};
