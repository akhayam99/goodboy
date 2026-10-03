import { cn } from '../cn';
import { Skeleton } from './Skeleton';

type Props = {
  readonly label: string;
  readonly className?: string;
};

export const SkeletonRow = ({ label, className }: Props) => (
  <div
    role="status"
    aria-label={label}
    className={cn('flex min-h-8 min-w-0 items-center gap-3 px-2', className)}
  >
    <Skeleton className="h-3 w-1/3 rounded-sm" />
    <Skeleton className="h-3 w-1/5 rounded-sm" />
  </div>
);
