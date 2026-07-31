import type { ReactNode } from 'react';
import { cn, tintClasses, type Tone } from '@goodboy/ui';
import { TranscriptChevron } from '../TranscriptChevron';
import { TRANSCRIPT_ROW_HOVER } from '../transcript-row-hover';
import { TranscriptShell } from '../TranscriptShell';

type Props = {
  readonly tone: Tone;
  readonly icon?: ReactNode;
  readonly eyebrow: string;
  readonly preview?: ReactNode;
  readonly meta?: ReactNode;
  readonly open?: boolean;
  readonly onToggle?: () => void;
  readonly badge?: ReactNode;
  readonly grouped?: boolean;
  readonly 'aria-label'?: string;
  readonly 'data-testid'?: string;
};

export const TranscriptRowHeader = ({
  tone,
  icon,
  eyebrow,
  preview,
  meta,
  open = false,
  onToggle,
  badge,
  grouped = false,
  'aria-label': ariaLabel,
  'data-testid': testId,
}: Props) => {
  const tint = tintClasses(tone);
  const variant = grouped ? 'plain' : 'leftBorder';
  const shape = grouped ? 'rounded-r-md py-1 pl-2 pr-2' : '';
  const content = (
    <>
      {onToggle ? <TranscriptChevron open={open} /> : <span aria-hidden className="w-3 shrink-0" />}
      {icon != null && <span className={cn('flex shrink-0 items-center', tint.icon)}>{icon}</span>}
      <span
        className={cn(
          'shrink-0 text-2xs font-medium uppercase tracking-wide opacity-80',
          tint.text,
        )}
      >
        {eyebrow}
      </span>
      {badge}
      <span className="min-w-0 flex-1 truncate text-xs text-foreground/60">{preview}</span>
      {meta != null && (
        <span className="shrink-0 font-mono text-2xs tabular-nums text-muted-foreground">
          {meta}
        </span>
      )}
    </>
  );

  if (!onToggle) {
    return (
      <TranscriptShell
        tone={tone}
        variant={variant}
        data-testid={testId}
        className={cn('flex w-full items-center gap-2 text-left', shape)}
      >
        {content}
      </TranscriptShell>
    );
  }

  return (
    <TranscriptShell
      as="button"
      type="button"
      tone={tone}
      variant={variant}
      aria-expanded={open}
      aria-label={ariaLabel}
      onClick={onToggle}
      data-testid={testId}
      className={cn('flex w-full items-center gap-2 text-left', shape, TRANSCRIPT_ROW_HOVER)}
    >
      {content}
    </TranscriptShell>
  );
};
