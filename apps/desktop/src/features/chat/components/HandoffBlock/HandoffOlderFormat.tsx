import { useState } from 'react';
import { Inbox } from 'lucide-react';
import { Markdown, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { codeFenceMarkers } from '../../utils/codeFenceMarkers';
import { formatCardTime } from '../../utils/format-card-time';
import { TranscriptDisclosure } from '../TranscriptDisclosure';
import { TranscriptRowHeader } from '../TranscriptRowHeader';

type Props = {
  readonly text: string;
  readonly at: string;
};

const CLAMP_LINES = 8;

export const HandoffOlderFormat = ({ text, at }: Props) => {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const isLong = text.split('\n').length > CLAMP_LINES || text.length > CLAMP_LINES * 100;

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
          eyebrow="first message"
          preview="older format"
          meta={formatCardTime(at)}
          open={open}
          onToggle={() => setOpen((value) => !value)}
          aria-label={open ? 'Collapse the first message' : 'Expand the first message'}
        />
      }
    >
      <div
        className={cn(
          'overflow-hidden text-label text-foreground',
          isLong && !showAll && 'line-clamp-8',
        )}
      >
        <Markdown text={codeFenceMarkers({ text })} />
      </div>
      {isLong ? (
        <button
          type="button"
          onClick={() => setShowAll((value) => !value)}
          className="w-fit text-secondary font-medium text-muted-foreground hover:text-foreground"
        >
          {showAll ? 'Show less' : 'Show all'}
        </button>
      ) : null}
    </TranscriptDisclosure>
  );
};
