import type { MountId, SessionId } from '@goodboy/types';
import { ListGridGroup } from '@goodboy/ui';
import type { MountRowView } from '../../../../store/slices/project-mounts/mountRowModel';
import { alsoOnBranchesOf } from '../../../session/branchGroupsOf';
import type { BranchWorkHeading } from '../../../session/branchWorkHeading';
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
import { ArtifactWorkRow } from './ArtifactWorkRow';

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
  readonly heading: BranchWorkHeading;
  readonly onToggle: () => void;
  readonly onReveal: (params: RevealParams) => void;
  readonly canOpenBranch: (params: OpenBranchParams) => boolean;
  readonly onTogglePartsOf: (rowId: string) => void;
  readonly onOpenRow: (params: ArtifactOpenParams) => void;
};

type ChipParams = Pick<Props, 'mounts' | 'onReveal' | 'canOpenBranch'> & {
  readonly item: ArtifactBranchItem;
  readonly groupKey: string;
};

const alsoOnChipOf = ({ item, groupKey, mounts, onReveal, canOpenBranch }: ChipParams) => {
  const branches = alsoOnBranchesOf({ branches: item.branches, groupKey, mounts });
  const [first] = branches;
  if (first === undefined || !canOpenBranch({ mountId: first.mountId })) {
    return undefined;
  }
  return (
    <AlsoOnChip
      branches={branches}
      onReveal={() => onReveal({ rowId: item.row.id, fromGroupKey: groupKey })}
    />
  );
};

export const ArtifactWorkGroup = ({
  group,
  mounts,
  sessionId,
  isOpen,
  openPartsIds,
  heading,
  onToggle,
  onReveal,
  canOpenBranch,
  onTogglePartsOf,
  onOpenRow,
}: Props) => {
  const used = group.items.filter((item) => item.row.group === 'consumed');
  const active = group.items.filter((item) => item.row.group !== 'consumed');
  const isFoldable = used.length > 0 && active.length > 0;
  const isFolded = isFoldable && !isOpen;
  const shown = isFolded ? active : group.items;
  const usedWord = ARTIFACT_GROUP_LABEL.consumed.toLowerCase();
  const rows = group.items.map((item) => item.row);
  const summary = artifactBranchSummaryOf({ rows, fact: null });
  return (
    <ListGridGroup
      headingLevel={2}
      label={heading.label}
      mark={heading.mark}
      count={artifactBranchCountOf({ rows })}
      fold={
        isFoldable
          ? { label: isFolded ? `${used.length} ${usedWord}` : `Hide ${usedWord}`, onToggle }
          : undefined
      }
      action={
        <>
          {summary === '' ? null : <span>{summary}</span>}
          {heading.action}
        </>
      }
    >
      {shown.map((item) => {
        const rowKey = artifactBranchRowKeyOf({ groupKey: group.key, rowId: item.row.id });
        return (
          <ArtifactWorkRow
            key={rowKey}
            row={item.row}
            rowKey={rowKey}
            titleSuffix={alsoOnChipOf({
              item,
              groupKey: group.key,
              mounts,
              onReveal,
              canOpenBranch,
            })}
            sessionId={sessionId}
            isPartsOpen={openPartsIds.has(rowKey)}
            onTogglePartsOf={onTogglePartsOf}
            onOpenRow={onOpenRow}
          />
        );
      })}
    </ListGridGroup>
  );
};
