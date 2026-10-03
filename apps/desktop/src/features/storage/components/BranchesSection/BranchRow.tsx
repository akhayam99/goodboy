import { Cloud, CloudOff, GitMerge, Laptop } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button, SelectionCheckbox, Tooltip, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { BranchOwnerCell } from './BranchOwnerCell';
import { formatSpan } from '../../../../shared/utils/time/formatSpan';
import type { BranchLocation } from '../../../worktree/branchCleanup';
import { LOCATION_LABEL, verdictCopy } from '../../branches/branchCopy';
import type { ClassifiedBranch } from '../../branches/classifyBranch';
import { useNow } from '../../../../shared/hooks/useNow';

const LOCATION_ICON: Readonly<Record<BranchLocation, LucideIcon>> = {
  'on-origin': Cloud,
  'local-only': Laptop,
  'gone-on-origin': CloudOff,
};

const BRANCH_ROW_GRID =
  'grid grid-cols-[20px_minmax(0,1fr)_220px_110px_200px_70px_70px] items-center gap-2';

type Props = {
  readonly entry: ClassifiedBranch;
  readonly selectId: string;
  readonly base: string;
  readonly isSelected: boolean;
  readonly isBusy: boolean;
  readonly onToggle: (isOn: boolean) => void;
  readonly onDelete: () => void;
};

export const BranchRow = ({
  entry,
  selectId,
  base,
  isSelected,
  isBusy,
  onToggle,
  onDelete,
}: Props) => {
  const now = useNow(30_000);
  const { branch } = entry;
  const verdict = verdictCopy({ branch, base });
  const LocationIcon = LOCATION_ICON[branch.location];
  const age =
    branch.lastCommitAt === null
      ? ''
      : formatSpan({ from: new Date(branch.lastCommitAt * 1000).toISOString(), to: now });
  return (
    <li
      data-select-id={selectId}
      className={cn(BRANCH_ROW_GRID, 'group/select-row h-[34px] rounded-md px-2 hover:bg-hover')}
    >
      <SelectionCheckbox
        checked={isSelected}
        onToggle={() => onToggle(!isSelected)}
        label={`Select ${branch.name}`}
        disabled={isBusy}
      />
      <Tooltip content={branch.name} anchorClassName="flex min-w-0">
        <span className="truncate font-mono text-code text-foreground">{branch.name}</span>
      </Tooltip>
      <span className="flex min-w-0">
        <BranchOwnerCell entry={entry} />
      </span>
      <span className="flex items-center gap-1 text-label text-muted-foreground">
        <LocationIcon size={ICON_SIZE.control} aria-hidden />
        {LOCATION_LABEL[branch.location]}
      </span>
      <span className="flex min-w-0 flex-col">
        <span
          className={cn(
            'flex items-center gap-1 truncate text-label',
            verdict.isSafe ? 'text-success' : 'text-foreground',
          )}
        >
          {verdict.isSafe && entry.verdict === 'safe-merged' ? (
            <GitMerge size={ICON_SIZE.control} aria-hidden />
          ) : null}
          {verdict.label}
        </span>
        {verdict.detail === null ? null : (
          <span className="truncate text-secondary text-faint-foreground">{verdict.detail}</span>
        )}
      </span>
      <span className="text-secondary tabular-nums text-muted-foreground">{age}</span>
      <Button variant="ghost" size="sm" disabled={isBusy} onClick={onDelete}>
        {verdict.isSafe ? 'Delete' : 'Delete…'}
      </Button>
    </li>
  );
};
