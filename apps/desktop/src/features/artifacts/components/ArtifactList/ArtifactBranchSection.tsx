import { useId, type ReactNode } from 'react';
import type { MountId, SessionId } from '@goodboy/types';
import { Button } from '@goodboy/ui';
import type { MountRowView } from '../../../../store/slices/project-mounts/mountRowModel';
import { alsoOnBranchesOf } from '../../../session/branchGroupsOf';
import { branchHeadLabelOf, branchHeadMarkOf } from '../../../session/branchHeadOf';
import { AlsoOnChip } from '../../../../shared/components/AlsoOnChip';
import {
  artifactBranchCountOf,
  artifactBranchRowKeyOf,
  artifactBranchSummaryOf,
} from '../../artifactBranchRowKeys';
import {
  ARTIFACT_GROUP_LABEL,
  type ArtifactBranchGroup,
  type ArtifactBranchItem,
} from '../../artifactListRows';
import type { ArtifactOpenParams } from './artifactBranchProps';
import { ArtifactListRow } from './ArtifactListRow';

type OpenBranchParams = {
  readonly mountId: MountId;
};

type RevealParams = {
  readonly rowId: string;
  readonly fromGroupKey: string;
};

type Props = {
  readonly group: ArtifactBranchGroup;
  readonly mounts: ReadonlyArray<MountRowView>;
  readonly sessionId: SessionId;
  readonly isOpen: boolean;
  readonly openPartsIds: ReadonlySet<string>;
  readonly hasActionColumn: boolean;
  readonly onToggle: () => void;
  readonly onReveal: (params: RevealParams) => void;
  readonly onTogglePartsOf: (rowId: string) => void;
  readonly onOpenRow: (params: ArtifactOpenParams) => void;
  readonly onOpenBranch: (params: OpenBranchParams) => void;
};

const NO_BRANCH_NOTE = 'not tied to a branch';

type ChipParams = {
  readonly item: ArtifactBranchItem;
  readonly groupKey: string;
  readonly mounts: ReadonlyArray<MountRowView>;
  readonly onReveal: (params: RevealParams) => void;
};

const branchChipOf = ({ item, groupKey, mounts, onReveal }: ChipParams): ReactNode => {
  const branches = alsoOnBranchesOf({ branches: item.branches, groupKey, mounts });
  if (branches.length === 0) {
    return undefined;
  }
  return (
    <span className="flex min-w-0 max-w-[35%] shrink-0">
      <AlsoOnChip
        branches={branches}
        onReveal={() => onReveal({ rowId: item.row.id, fromGroupKey: groupKey })}
      />
    </span>
  );
};

export const ArtifactBranchSection = ({
  group,
  mounts,
  sessionId,
  isOpen,
  openPartsIds,
  hasActionColumn,
  onToggle,
  onReveal,
  onTogglePartsOf,
  onOpenRow,
  onOpenBranch,
}: Props) => {
  const headingId = useId();
  const { head } = group;
  const used = group.items.filter((item) => item.row.group === 'consumed');
  const active = group.items.filter((item) => item.row.group !== 'consumed');
  const isFoldable = used.length > 0 && active.length > 0;
  const isFolded = isFoldable && !isOpen;
  const shown = isFolded ? active : group.items;
  const mark = branchHeadMarkOf({ head });
  const usedWord = ARTIFACT_GROUP_LABEL.consumed.toLowerCase();
  const rows = group.items.map((item) => item.row);
  const count = artifactBranchCountOf({ rows });
  const summary = artifactBranchSummaryOf({
    rows,
    fact: head.kind === 'branch' ? head.fact : null,
  });
  return (
    <section
      data-testid={`artifact-branch-group-${group.key}`}
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col gap-2"
    >
      <div className="flex h-5 min-w-0 items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {mark === null ? null : (
            <span className="shrink-0 text-ui text-faint-foreground">{mark}</span>
          )}
          <h2
            id={headingId}
            className="flex min-w-0 items-center gap-2 text-heading text-foreground"
          >
            <span className="truncate">{branchHeadLabelOf({ head })}</span>
            {count > 1 ? (
              <span className="text-ui tabular-nums text-faint-foreground">{count}</span>
            ) : null}
          </h2>
          {isFoldable ? (
            <Button variant="quiet" size="xs" aria-expanded={isOpen} onClick={onToggle}>
              {isFolded ? `${used.length} ${usedWord}` : `Hide ${usedWord}`}
            </Button>
          ) : null}
        </div>
        <span className="flex shrink-0 items-center gap-2 text-ui text-faint-foreground">
          {head.kind === 'none' ? <span>{NO_BRANCH_NOTE}</span> : null}
          {summary === '' ? null : <span>{summary}</span>}
          {head.kind === 'branch' ? (
            <Button
              variant="quiet"
              size="xs"
              onClick={() => onOpenBranch({ mountId: head.branch.mountId })}
            >
              Open branch
            </Button>
          ) : null}
        </span>
      </div>
      <ul className="flex min-w-0 flex-col">
        {shown.map((item) => {
          const rowKey = artifactBranchRowKeyOf({ groupKey: group.key, rowId: item.row.id });
          return (
            <li key={rowKey} className="min-w-0">
              <ArtifactListRow
                row={item.row}
                rowKey={rowKey}
                isStateShown
                titleSuffix={branchChipOf({
                  item,
                  groupKey: group.key,
                  mounts,
                  onReveal,
                })}
                sessionId={sessionId}
                isPartsOpen={openPartsIds.has(rowKey)}
                onTogglePartsOf={onTogglePartsOf}
                onOpenRow={onOpenRow}
                hasActionColumn={hasActionColumn}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
};
