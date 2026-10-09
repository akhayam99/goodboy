import type { ReactNode } from 'react';
import { cn } from '../cn';
import { TEXT_ROLE } from '../textRoles';
import { tintClasses, type Tone } from '../tint';

export const EYEBROW_CLASS = 'text-eyebrow';

export type EyebrowProps = {
  readonly label: ReactNode;
  readonly icon?: ReactNode;
  readonly tone?: Tone;
  readonly badge?: boolean;
  readonly muted?: boolean;
  readonly className?: string;
};

export const Eyebrow = ({
  label,
  icon,
  tone = 'neutral',
  badge,
  muted,
  className,
}: EyebrowProps) => {
  if (badge) {
    const tint = tintClasses(tone);
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-md px-2 py-1 leading-none ring-1',
          EYEBROW_CLASS,
          tint.bg,
          tint.ring,
          tint.text,
          className,
        )}
      >
        {icon}
        {label}
      </span>
    );
  }

  return (
    <span
      className={cn(
        EYEBROW_CLASS,
        muted ? TEXT_ROLE.hint : TEXT_ROLE.secondary,
        icon ? 'inline-flex items-center gap-1' : '',
        className,
      )}
    >
      {icon}
      {label}
    </span>
  );
};
