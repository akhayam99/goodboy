import { cn } from '../cn';

interface Props {
  className?: string;
}

export function Skeleton({ className }: Props) {
  return (
    <div className={cn('motion-safe:animate-pulse rounded bg-muted', className)} aria-hidden />
  );
}
