import type { MouseEventHandler, ReactNode } from 'react';
import { cn, tintClasses, ToneBar, type Tone, Tooltip } from '@goodboy/ui';

type Variant = 'boxed' | 'leftBorder' | 'pill' | 'plain';

type Props = {
  readonly as?: 'div' | 'button';
  readonly tone: Tone;
  readonly variant: Variant;
  readonly children: ReactNode;
  readonly className?: string;
  readonly emphasis?: boolean;
  readonly type?: 'button' | 'submit' | 'reset';
  readonly onClick?: MouseEventHandler<HTMLButtonElement>;
  readonly title?: string;
  readonly 'aria-label'?: string;
  readonly 'aria-expanded'?: boolean;
  readonly 'data-testid'?: string;
  readonly onContextMenu?: MouseEventHandler<HTMLElement>;
};

export const TranscriptShell = ({
  as = 'div',
  tone,
  variant,
  children,
  className,
  emphasis = false,
  type,
  onClick,
  title,
  'aria-label': ariaLabel,
  'aria-expanded': ariaExpanded,
  'data-testid': testId,
  onContextMenu,
}: Props) => {
  const accent = tintClasses(tone);
  const hasRail = tone !== 'neutral';
  const bar =
    variant === 'boxed' ? (
      <ToneBar tone={tone} density="card" className={cn(!emphasis && 'opacity-50')} />
    ) : variant === 'leftBorder' && hasRail ? (
      <ToneBar tone={tone} density="row" />
    ) : null;
  const shellClassName = cn(
    variant === 'boxed' && 'relative rounded-md py-2 pl-4 pr-3',
    variant === 'leftBorder' && 'relative py-1 pl-3 pr-2',
    variant === 'leftBorder' && hasRail && 'rounded-md',
    variant === 'pill' && 'rounded-full border px-3 py-1',
    variant === 'pill' && accent.border,
    variant === 'pill' && accent.bg,
    className,
  );

  if (as === 'button') {
    return (
      <Tooltip content={title}>
        <button
          type={type}
          onClick={onClick}
          aria-label={ariaLabel}
          aria-expanded={ariaExpanded}
          data-testid={testId}
          className={shellClassName}
        >
          {bar}
          {children}
        </button>
      </Tooltip>
    );
  }

  return (
    <div
      data-reading-region=""
      className={shellClassName}
      data-testid={testId}
      onContextMenu={onContextMenu}
    >
      {bar}
      {children}
    </div>
  );
};
