import type { ReactNode } from 'react';
import { cn } from '../cn';
import { tintClasses, type Tone } from '../tint';

export type Props = {
  readonly children: ReactNode;
  readonly size?: 'xs' | 'sm' | 'md' | 'lg';
  readonly tone?: Tone;
  readonly color?: string;
  readonly ring?: boolean;
  readonly className?: string;
};

const SIZE_CLASSES = {
  xs: 'size-5 rounded-md',
  sm: 'size-7 rounded-md',
  md: 'size-9 rounded-lg',
  lg: 'size-11 rounded-lg',
} satisfies Record<NonNullable<Props['size']>, string>;

export const IconTile = ({ children, size = 'sm', tone, color, ring, className }: Props) => {
  const tint = tone != null && color == null ? tintClasses(tone) : null;
  const isRingVisible = ring ?? tint != null;

  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center',
        SIZE_CLASSES[size],
        tint?.bg,
        tint?.icon,
        isRingVisible && 'ring-1',
        isRingVisible && tint?.ring,
        className,
      )}
      style={
        color != null
          ? {
              backgroundColor: `color-mix(in oklab, ${color} 15%, transparent)`,
              color,
            }
          : undefined
      }
    >
      {children}
    </span>
  );
};
