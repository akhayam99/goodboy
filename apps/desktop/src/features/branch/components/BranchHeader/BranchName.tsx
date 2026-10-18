import { cn, Tooltip } from '@goodboy/ui';

type Props = {
  readonly branch: string;
  readonly className?: string;
};

export const BranchName = ({ branch, className }: Props) => (
  <Tooltip content={branch}>
    <span className={cn('min-w-0 truncate text-code', className)}>{branch}</span>
  </Tooltip>
);
