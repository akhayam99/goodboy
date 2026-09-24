import type { ReactNode } from 'react';
import { Check, Copy, X } from 'lucide-react';
import { cn } from '../cn';
import { FOCUS_RING } from '../focusRing';
import { useCopyLink } from '../useCopyLink';
import { Tooltip } from './Tooltip';

export type CopyButtonProps = {
  value: string;
  label?: string;
  size?: number;
  className?: string;
  children?: ReactNode;
  presentation?: 'text' | 'icon';
};

const GLYPH = { idle: Copy, copied: Check, failed: X } as const;

type CopyState = keyof typeof GLYPH;

const STATE_TEXT: Record<CopyState, string> = {
  idle: 'Copy',
  copied: 'Copied',
  failed: 'Copy failed',
};

const STATE_TOOLTIP: Record<CopyState, string | null> = {
  idle: null,
  copied: 'Copied',
  failed: 'Copy failed',
};

export const CopyButton = ({
  value,
  label = 'Copy',
  size = 11,
  className,
  children,
  presentation = 'text',
}: CopyButtonProps) => {
  const { copiedKey, failedKey, copy } = useCopyLink();
  const state = failedKey !== null ? 'failed' : copiedKey !== null ? 'copied' : 'idle';
  const Glyph = GLYPH[state];

  return (
    <Tooltip content={STATE_TOOLTIP[state] ?? label}>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          void copy({ text: value });
        }}
        aria-label={presentation === 'text' ? `Copy ${label === 'Copy' ? 'text' : label}` : label}
        className={cn(
          'inline-flex shrink-0 items-center rounded-md p-1 motion-safe:transition-colors',
          FOCUS_RING,
          state === 'idle' && 'text-muted-foreground hover:bg-hover hover:text-foreground',
          state === 'copied' && 'text-success',
          state === 'failed' && 'text-danger',
          className,
        )}
      >
        {presentation === 'icon' ? <Glyph size={size} aria-hidden /> : null}
        {presentation === 'text' ? STATE_TEXT[state] : null}
        {presentation === 'icon' && children != null && (state === 'copied' ? 'Copied' : children)}
      </button>
    </Tooltip>
  );
};
