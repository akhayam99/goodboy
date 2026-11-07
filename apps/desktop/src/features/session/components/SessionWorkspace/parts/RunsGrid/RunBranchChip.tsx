import { Chip, OptionalTooltip, cn } from '@goodboy/ui';
import type { MountId } from '@goodboy/types';
import type { WorkBranch } from '../../../../workBranchesOf';
import { branchListLabelOf } from '../../../../../../shared/utils/branchListLabelOf';

type OpenParams = {
  readonly mountId: MountId;
};

type Props = {
  readonly branches: ReadonlyArray<WorkBranch>;
  readonly onOpenBranch: (params: OpenParams) => void;
};

const CHIP = 'rounded-sm bg-hover px-1 text-chip text-faint-foreground';

export const RunBranchChip = ({ branches, onOpenBranch }: Props) => {
  const [first, ...rest] = branches;
  if (first === undefined) {
    return null;
  }
  return (
    <>
      <OptionalTooltip content={branchListLabelOf({ branches: [first] })}>
        <Chip
          as="button"
          tone="neutral"
          kind="id"
          bordered={false}
          emphasis="subtle"
          testId="run-branch"
          ariaLabel={`Open branch ${first.branch}`}
          label={<span className="truncate">{first.branch}</span>}
          className="min-w-0 shrink-[8]"
          onClick={() => onOpenBranch({ mountId: first.mountId })}
        />
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
