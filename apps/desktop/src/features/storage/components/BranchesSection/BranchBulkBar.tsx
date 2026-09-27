import { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import type { ProjectId } from '@goodboy/types';
import { Button, Checkbox, InlineConfirm } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { pluralize } from '../../../../shared/utils/pluralize';
import { branchCount } from '../../branches/branchCopy';
import {
  isSafeVerdict,
  unmergedCommits,
  type ClassifiedBranch,
} from '../../branches/classifyBranch';

export type SelectedBranch = {
  readonly projectId: ProjectId;
  readonly projectName: string;
  readonly entry: ClassifiedBranch;
  readonly canDeleteOnOrigin: boolean;
};

type Props = {
  readonly selected: ReadonlyArray<SelectedBranch>;
  readonly isConfirming: boolean;
  readonly isBusy: boolean;
  readonly onClear: () => void;
  readonly onArm: () => void;
  readonly onCancel: () => void;
  readonly onConfirm: (params: { readonly alsoOrigin: boolean }) => void;
};

const joinNames = (names: ReadonlyArray<string>): string => {
  if (names.length <= 1) {
    return names[0] ?? '';
  }
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
};

export const BranchBulkBar = ({
  selected,
  isConfirming,
  isBusy,
  onClear,
  onArm,
  onCancel,
  onConfirm,
}: Props) => {
  const [alsoOrigin, setAlsoOrigin] = useState(false);
  if (selected.length === 0) {
    return null;
  }
  const count = selected.length;
  if (!isConfirming) {
    return (
      <div className="flex flex-wrap items-center gap-3 px-2 py-1.5">
        <span className="text-label text-foreground">{count} selected</span>
        <Button variant="ghost" size="sm" onClick={onClear} disabled={isBusy}>
          Clear
        </Button>
        <Button variant="secondary" size="sm" onClick={onArm} disabled={isBusy}>
          <Trash2 size={ICON_SIZE.row} aria-hidden />
          Delete {branchCount(count)}
        </Button>
      </div>
    );
  }
  const unmerged = selected.filter(({ entry }) => !isSafeVerdict(entry.verdict));
  const lostCommits = unmerged.reduce((sum, { entry }) => sum + unmergedCommits(entry), 0);
  const originEligible = selected.filter(
    ({ entry, canDeleteOnOrigin }) => canDeleteOnOrigin && isSafeVerdict(entry.verdict),
  ).length;
  const projectNames = joinNames([...new Set(selected.map(({ projectName }) => projectName))]);
  const title =
    unmerged.length === 0
      ? `Delete ${count === 1 ? '1 merged branch' : `${count} merged branches`} in ${projectNames}? Nothing is lost: their work is merged.`
      : `Delete ${branchCount(count)} in ${projectNames}?`;
  const confirmLabel =
    lostCommits === 0
      ? `Delete ${branchCount(count)}`
      : `Delete ${branchCount(count)} and ${pluralize(lostCommits, 'commit')}`;
  return (
    <InlineConfirm
      role="danger"
      icon={<AlertTriangle size={ICON_SIZE.row} aria-hidden />}
      title={title}
      description="Kept for 14 days so you can restore one."
      confirmLabel={confirmLabel}
      isBusy={isBusy}
      onConfirm={() => onConfirm({ alsoOrigin: alsoOrigin && originEligible > 0 })}
      onCancel={onCancel}
      note={
        unmerged.length === 0 ? null : (
          <p className="text-label text-warning">
            {unmerged.length === 1 ? "1 isn't merged" : `${unmerged.length} aren't merged`}:{' '}
            {lostCommits === 1 ? '1 commit exists' : `${lostCommits} commits exist`} only in these
            branches.
          </p>
        )
      }
    >
      {originEligible === 0 ? null : (
        <Checkbox
          checked={alsoOrigin}
          onChange={setAlsoOrigin}
          disabled={isBusy}
          label={`Also delete ${originEligible} on origin`}
        />
      )}
    </InlineConfirm>
  );
};
