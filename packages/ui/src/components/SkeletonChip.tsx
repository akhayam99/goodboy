import { cn } from '../cn';
import { Skeleton } from './Skeleton';

const CHIP_WIDTH = {
  sm: 'w-14',
  md: 'w-20',
  lg: 'w-28',
} satisfies Record<string, string>;

type Props = {
  readonly width?: keyof typeof CHIP_WIDTH;
  readonly className?: string;
};

export const SkeletonChip = ({ width = 'md', className }: Props) => (
  <Skeleton className={cn('h-6 shrink-0 rounded-md', CHIP_WIDTH[width], className)} />
);
