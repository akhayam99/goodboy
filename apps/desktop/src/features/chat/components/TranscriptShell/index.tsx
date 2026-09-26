import type { MouseEventHandler, ReactNode } from 'react';
import { cn, tintClasses, type Tone } from '@goodboy/ui';

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
}: Props) => {
  const accent = tintClasses(tone);
  const hasRail = tone !== 'neutral';
  const shellClassName = cn(
    variant === 'boxed' && 'rounded-r-md border-l-2 py-2 pl-3 pr-3',
    variant === 'boxed' && (emphasis ? accent.border : accent.borderSoft),
    variant === 'leftBorder' &&
      (hasRail ? 'rounded-r-md border-l-2 py-1 pl-2 pr-2' : 'py-1 pl-2 pr-2'),
    variant === 'leftBorder' && hasRail && accent.border,
    variant === 'pill' && 'rounded-full border px-2.5 py-1',
    variant === 'pill' && accent.border,
    variant === 'pill' && accent.bg,
    className,
  );

  if (as === 'button') {
    return (
      <button
        type={type}
        onClick={onClick}
        title={title}
        aria-label={ariaLabel}
        aria-expanded={ariaExpanded}
        data-testid={testId}
        className={shellClassName}
      >
        {children}
      </button>
    );
  }

  return (
    <div className={shellClassName} data-testid={testId}>
      {children}
    </div>
  );
};
