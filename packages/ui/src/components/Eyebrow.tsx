import type { ReactNode } from 'react';
import { cn } from '../cn';
import { tintClasses, type Tone } from '../tint';

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
          'inline-flex items-center gap-1 rounded-md px-1.5 py-px text-2xs font-semibold uppercase leading-none tracking-eyebrow ring-1',
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
        'text-2xs font-semibold uppercase tracking-eyebrow',
        muted ? 'text-muted-foreground/60' : 'text-muted-foreground',
        icon ? 'inline-flex items-center gap-1' : '',
        className,
      )}
    >
      {icon}
      {label}
    </span>
  );
};
