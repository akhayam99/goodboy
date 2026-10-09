import { useState } from 'react';
import { Inbox } from 'lucide-react';
import { Markdown } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { ClampedText } from '../../../../shared/components/ClampedText';
import { codeFenceMarkers } from '../../utils/codeFenceMarkers';
import { formatClock } from '../../../../shared/utils/time/formatClock';
import { TranscriptDisclosure } from '../TranscriptDisclosure';
import { TranscriptRowHeader } from '../TranscriptRowHeader';

type Props = {
  readonly text: string;
  readonly at: string;
};

export const HandoffOlderFormat = ({ text, at }: Props) => {
  const [open, setOpen] = useState(false);

  return (
    <TranscriptDisclosure
      tone="neutral"
      open={open}
      data-testid="handoff-older-format"
      header={
        <TranscriptRowHeader
          grouped
          tone="neutral"
          icon={<Inbox size={ICON_SIZE.row} aria-hidden />}
          eyebrow="First message"
          preview="Older format"
          meta={formatClock({ at })}
          open={open}
          onToggle={() => setOpen((value) => !value)}
          aria-label={open ? 'Collapse the first message' : 'Expand the first message'}
        />
      }
    >
      <ClampedText text={text} className="overflow-hidden text-label text-foreground">
        <Markdown text={codeFenceMarkers({ text })} />
      </ClampedText>
    </TranscriptDisclosure>
  );
};
