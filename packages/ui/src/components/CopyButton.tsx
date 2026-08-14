import type { ReactNode } from 'react';
import { Check, Copy, X } from 'lucide-react';
import { cn } from '../cn';
import { useCopyLink } from '../useCopyLink';

export type CopyButtonProps = {
  value: string;
  label?: string;
  size?: number;
  className?: string;
  children?: ReactNode;
  presentation?: 'text' | 'icon';
};

const GLYPH = { idle: Copy, copied: Check, failed: X } as const;

export const CopyButton = ({
  value,
  label = 'Copy',
  size = 11,
  className,
  children,
  presentation = 'text',
}: CopyButtonProps) => {
  const { copied, failed, copy } = useCopyLink();
  const state = failed ? 'failed' : copied ? 'copied' : 'idle';
  const Glyph = GLYPH[state];

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        void copy(value);
      }}
      title={state === 'idle' ? label : state === 'copied' ? 'copied' : 'copy failed'}
      aria-label={presentation === 'text' ? `copy ${label === 'Copy' ? 'text' : label}` : label}
      className={cn(
        'inline-flex shrink-0 items-center rounded-md p-1 transition-colors',
        state === 'idle' && 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
        state === 'copied' && 'text-success',
        state === 'failed' && 'text-danger',
        className,
      )}
    >
      {presentation === 'icon' ? <Glyph size={size} aria-hidden /> : null}
      {presentation === 'text'
        ? state === 'copied'
          ? `copied: ${label === 'Copy' ? 'text' : label}`
          : state === 'failed'
            ? 'copy failed'
            : 'copy'
        : null}
      {presentation === 'icon' && children != null && (state === 'copied' ? 'Copied' : children)}
    </button>
  );
};
