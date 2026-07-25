import { useState } from 'react';
import { cn } from '@goodboy/ui';
import { TranscriptChevron } from '../TranscriptChevron';
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
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-2 text-left text-muted-foreground/70',
          TRANSCRIPT_ROW_HOVER,
        )}
      >
        <TranscriptChevron open={open} />
        <span className="text-2xs">
          {label ?? 'string'} ({value.length} chars)
        </span>
      </button>
      {open ? (
        <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/30 p-1.5 text-foreground/80">
          {value}
        </pre>
      ) : (
        <span className="text-foreground/60">{preview}</span>
      )}
    </div>
  );
};
