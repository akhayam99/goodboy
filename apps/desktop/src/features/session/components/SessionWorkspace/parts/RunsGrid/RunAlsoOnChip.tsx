import { OptionalTooltip, cn } from '@goodboy/ui';
import type { WorkBranch } from '../../../../workBranchesOf';
import { alsoOnLabelOf } from './alsoOnLabelOf';
import { branchListLabelOf } from './branchListLabelOf';

type Props = {
  readonly branches: ReadonlyArray<WorkBranch>;
};

export const RunAlsoOnChip = ({ branches }: Props) => {
  if (branches.length === 0) {
    return null;
  }
  return (
    <OptionalTooltip content={branchListLabelOf({ branches })}>
      <span
        data-run-also-on=""
        className={cn(
          'min-w-0 shrink-[8] truncate rounded-sm bg-hover px-1 text-chip text-faint-foreground',
        )}
      >
        {alsoOnLabelOf({ branches })}
      </span>
    </OptionalTooltip>
  );
};
