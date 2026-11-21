import { cn } from '../cn';
import { Skeleton } from './Skeleton';

type Props = {
  readonly label: string;
  readonly count?: number;
  readonly className?: string;
};

export const SkeletonRows = ({ label, count = 3, className }: Props) => (
  <div
    role="status"
    aria-label={label}
    aria-busy="true"
    className={cn('flex min-w-0 flex-col', className)}
  >
    {Array.from({ length: count }).map((_, index) => (
      <div key={index} className="flex min-h-8 min-w-0 items-center gap-3 px-2">
        <Skeleton className="h-3 w-1/3 rounded-sm" />
        <Skeleton className="h-3 w-1/5 rounded-sm" />
      </div>
    ))}
  </div>
);
