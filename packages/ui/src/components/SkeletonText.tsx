import { cn } from '../cn';
import { Skeleton } from './Skeleton';

type Props = {
  className?: string;
  lines?: number;
};

export const SkeletonText = ({ className, lines = 3 }: Props) => {
  return (
    <div className={cn('flex flex-col gap-2', className)} role="status" aria-label="Loading">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-3 rounded-sm', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
};
