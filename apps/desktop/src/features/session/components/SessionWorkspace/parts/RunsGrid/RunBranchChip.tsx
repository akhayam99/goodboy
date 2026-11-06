import { OptionalTooltip, cn } from '@goodboy/ui';
import type { WorkBranch } from '../../../../workBranchesOf';
import { branchListLabelOf } from './branchListLabelOf';

type Props = {
  readonly branches: ReadonlyArray<WorkBranch>;
};

const CHIP = 'rounded-sm bg-hover px-1 text-chip text-faint-foreground';

export const RunBranchChip = ({ branches }: Props) => {
  const [first, ...rest] = branches;
  if (first === undefined) {
    return null;
  }
  return (
    <>
      <OptionalTooltip content={branchListLabelOf({ branches: [first] })}>
        <span data-run-branch="" className={cn(CHIP, 'min-w-0 shrink-[8] truncate')}>
          {first.branch}
        </span>
      </OptionalTooltip>
      {rest.length === 0 ? null : (
        <OptionalTooltip content={branchListLabelOf({ branches: rest })}>
          <span data-run-branch-more="" className={cn(CHIP, 'shrink-0 tabular-nums')}>
            +{rest.length}
          </span>
        </OptionalTooltip>
      )}
    </>
  );
};
