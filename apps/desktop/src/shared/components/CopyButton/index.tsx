import type { ReactNode } from 'react';
import { Check, Copy, X } from 'lucide-react';
import { cn } from '@goodboy/ui';
import { useCopyLink } from '../../hooks/useCopyLink';

type Props = {
  readonly value: string;
  readonly label: string;
  readonly size?: number;
  readonly className?: string;
  readonly children?: ReactNode;
};

type CopyState = 'idle' | 'copied' | 'failed';

type StateParams = {
  readonly copied: boolean;
  readonly failed: boolean;
};

const GLYPH = { idle: Copy, copied: Check, failed: X } as const;

const TONE = {
  idle: 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
  copied: 'text-success',
  failed: 'text-danger',
} as const;

const TITLE = { copied: 'copied', failed: 'copy failed' } as const;

const copyState = ({ copied, failed }: StateParams): CopyState => {
  if (failed) {
    return 'failed';
  }
  if (copied) {
    return 'copied';
  }
  return 'idle';
};

export const CopyButton = ({ value, label, size = 11, className, children }: Props) => {
  const { copied, failed, copy } = useCopyLink();
  const state = copyState({ copied, failed });
  const Glyph = GLYPH[state];

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        void copy(value);
      }}
      title={state === 'idle' ? label : TITLE[state]}
      aria-label={label}
      className={cn(
        'inline-flex shrink-0 items-center rounded-md p-1 transition-colors',
        className,
        TONE[state],
      )}
    >
      <Glyph size={size} aria-hidden />
      {children != null && (state === 'copied' ? 'Copied' : children)}
    </button>
  );
};
