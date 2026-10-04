import { Cloud, CloudOff, GitMerge, Laptop } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button, SelectionCheckbox, Tooltip, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { formatSpan } from '../../../../shared/utils/time/formatSpan';
import type { BranchLocation } from '../../../worktree/branchCleanup';
import { LOCATION_LABEL, verdictCopy } from '../../branches/branchCopy';
import { BRANCH_TABLE_GRID } from '../../branches/branchTableGrid';
import type { ClassifiedBranch } from '../../branches/classifyBranch';
import { useNow } from '../../../../shared/hooks/useNow';
import { BranchSessionCells } from './BranchSessionCells';

const LOCATION_ICON: Readonly<Record<BranchLocation, LucideIcon>> = {
  'on-origin': Cloud,
  'local-only': Laptop,
  'gone-on-origin': CloudOff,
};

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
  const status = verdict.detail === null ? verdict.label : `${verdict.label} · ${verdict.detail}`;
  return (
    <li
      data-select-id={selectId}
      className={cn(BRANCH_TABLE_GRID, 'group/select-row rounded-md px-2 hover:bg-hover')}
    >
      <span data-cell="select" className="flex items-center">
        <SelectionCheckbox
          checked={isSelected}
          onToggle={() => onToggle(!isSelected)}
          label={`Select ${branch.name}`}
          disabled={isBusy}
        />
      </span>
      <span data-cell="branch" className="flex min-w-0">
        <Tooltip content={branch.name} anchorClassName="flex min-w-0">
          <span className="truncate font-mono text-code text-foreground">{branch.name}</span>
        </Tooltip>
      </span>
      <BranchSessionCells entry={entry} />
      <span
        data-cell="origin"
        className="flex min-w-0 items-center gap-1 text-label text-muted-foreground"
      >
        <LocationIcon size={ICON_SIZE.control} aria-hidden className="shrink-0" />
        <span className="truncate">{LOCATION_LABEL[branch.location]}</span>
      </span>
      <span data-cell="status" className="flex min-w-0">
        <Tooltip content={status} anchorClassName="flex min-w-0">
          <span
            className={cn(
              'flex min-w-0 items-center gap-1 text-label',
              verdict.isSafe ? 'text-success' : 'text-foreground',
            )}
          >
            {verdict.isSafe && entry.verdict === 'safe-merged' ? (
              <GitMerge size={ICON_SIZE.control} aria-hidden className="shrink-0" />
            ) : null}
            <span className="truncate">
              {verdict.label}
              {verdict.detail === null ? null : (
                <span className="text-faint-foreground"> {verdict.detail}</span>
              )}
            </span>
          </span>
        </Tooltip>
      </span>
      <span data-cell="age" className="text-right text-meta tabular-nums text-muted-foreground">
        {age}
      </span>
      <span data-cell="action" className="flex justify-end">
        <Button variant="ghost" size="sm" disabled={isBusy} onClick={onDelete}>
          {verdict.isSafe ? 'Delete' : 'Delete…'}
        </Button>
      </span>
    </li>
  );
};
