import { useState } from 'react';
import { cn, ScrollFade } from '@goodboy/ui';
import { TranscriptChevron } from '../TranscriptChevron';
import { TranscriptDisclosure } from '../TranscriptDisclosure';
import { TRANSCRIPT_ROW_HOVER } from '../transcript-row-hover';

type Props = {
  readonly value: string;
  readonly label?: string;
};

const PREVIEW_LENGTH = 120;

export const CollapsibleString = ({ value, label }: Props) => {
  const [open, setOpen] = useState(false);
  const preview = `${value.slice(0, PREVIEW_LENGTH)}...`;

  return (
    <TranscriptDisclosure
      tone="neutral"
      open={open}
      header={
        <>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className={cn(
              'flex items-center gap-2 rounded-r-md py-1 pl-2 pr-2 text-left text-muted-foreground/70',
              TRANSCRIPT_ROW_HOVER,
            )}
          >
            <TranscriptChevron open={open} />
            <span className="text-2xs">
              {label ?? 'string'} ({value.length} chars)
            </span>
          </button>
          {open ? null : (
            <span className="min-w-0 break-words pb-1 pl-7 pr-2 text-foreground/60">{preview}</span>
          )}
        </>
      }
    >
      <ScrollFade className="max-h-60">
        <pre className="whitespace-pre-wrap break-words text-foreground/80">{value}</pre>
      </ScrollFade>
    </TranscriptDisclosure>
  );
};
