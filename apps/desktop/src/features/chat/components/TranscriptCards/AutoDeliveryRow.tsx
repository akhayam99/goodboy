import { useState } from 'react';
import { cn } from '@goodboy/ui';
import { TranscriptChevron } from '../TranscriptChevron';
import { TranscriptDisclosure } from '../TranscriptDisclosure';
import { TRANSCRIPT_ROW_HOVER } from '../transcript-row-hover';

type Props = {
  readonly text: string;
};

export const AutoDeliveryRow = ({ text }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <TranscriptDisclosure
      tone="neutral"
      open={isOpen}
      data-testid="auto-delivery-row"
      header={
        <div className="flex min-w-0 items-center gap-2 py-1 pl-2 pr-2">
          <button
            type="button"
            aria-expanded={isOpen}
            onClick={() => setIsOpen((wasOpen) => !wasOpen)}
            className={cn(
              'flex shrink-0 items-center gap-2 text-chip text-muted-foreground',
              TRANSCRIPT_ROW_HOVER,
            )}
          >
            <TranscriptChevron open={isOpen} />
            What Auto was told
          </button>
        </div>
      }
    >
      <pre className="whitespace-pre-wrap break-words px-2 py-1 text-code text-muted-foreground">
        {text}
      </pre>
    </TranscriptDisclosure>
  );
};
