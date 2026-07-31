import type { MouseEventHandler, ReactNode } from 'react';
import { cn, tintClasses, type Tone } from '@goodboy/ui';

type Variant = 'boxed' | 'leftBorder' | 'pill';

type Props = {
  readonly as?: 'div' | 'button';
  readonly tone: Tone;
  readonly variant: Variant;
  readonly children: ReactNode;
  readonly className?: string;
  readonly emphasis?: boolean;
  readonly nested?: boolean;
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
  nested = false,
  type,
  onClick,
  title,
  'aria-label': ariaLabel,
  'aria-expanded': ariaExpanded,
  'data-testid': testId,
}: Props) => {
  const accent = tintClasses(tone);
  const shellClassName = cn(
    variant === 'boxed' && 'rounded-lg border px-3 py-2',
    variant === 'boxed' && (emphasis ? accent.border : accent.borderSoft),
    variant === 'boxed' && (emphasis ? accent.bg : accent.bgSoft),
    variant === 'leftBorder' &&
      (nested ? 'border-l-2 py-2 pl-2 pr-2' : 'rounded-r-md border-l-2 py-1 pl-2 pr-2'),
    variant === 'leftBorder' && (nested ? accent.borderSoft : accent.border),
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
