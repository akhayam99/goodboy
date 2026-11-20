import type { CSSProperties } from 'react';
import { cn } from '../cn';

type Props = {
  className?: string;
  style?: CSSProperties;
};

export const Skeleton = ({ className, style }: Props) => {
  return (
    <span
      className={cn('block motion-safe:animate-pulse rounded-sm bg-skeleton', className)}
      style={style}
      aria-hidden
    />
  );
};
