import { cn, Tooltip } from '@goodboy/ui';
import { splitBranchLabel } from '../../../../shared/utils/branchLabel';

type Props = {
  readonly branch: string;
  readonly className?: string;
};

export const ExploreBranchName = ({ branch, className }: Props) => {
  const { head, tail } = splitBranchLabel({ branch });
  return (
    <Tooltip content={branch}>
      <span className={cn('flex min-w-0 items-center text-code', className)}>
        <span className="truncate">{head}</span>
        {tail === '' ? null : <span className="shrink-0">{tail}</span>}
      </span>
    </Tooltip>
  );
};
