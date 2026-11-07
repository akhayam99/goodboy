import { useCallback, useMemo, useState } from 'react';
import type { MountId, SessionId } from '@goodboy/types';
import { useGroupArrival } from '../../../../shared/hooks/useGroupArrival';
import type { MountRowView } from '../../../../store/slices/project-mounts/mountRowModel';
import { artifactBranchRowKeyOf } from '../../artifactBranchRowKeys';
import type { ArtifactBranchView } from '../../artifactListRows';
import type { ArtifactOpenParams } from './artifactBranchProps';
import { ArtifactBranchSection } from './ArtifactBranchSection';
import { ArtifactListGroup } from './ArtifactListGroup';

type OpenBranchParams = {
  readonly mountId: MountId;
};

type ArriveParams = {
  readonly groupKey: string;
};

type ToggleParams = {
  readonly key: string;
};

type RevealParams = {
  readonly rowId: string;
  readonly fromGroupKey: string;
};

type Props = {
  readonly view: ArtifactBranchView;
  readonly returnRowId: string | null;
  readonly mounts: ReadonlyArray<MountRowView>;
  readonly sessionId: SessionId;
  readonly openPartsIds: ReadonlySet<string>;
  readonly hasActionColumn: boolean;
  readonly onTogglePartsOf: (rowId: string) => void;
  readonly onOpenRow: (params: ArtifactOpenParams) => void;
  readonly onOpenBranch: (params: OpenBranchParams) => void;
};

export const ArtifactBranchList = ({
  view,
  returnRowId,
  mounts,
  sessionId,
  openPartsIds,
  hasActionColumn,
  onTogglePartsOf,
  onOpenRow,
  onOpenBranch,
}: Props) => {
  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        view.groups
          .filter((group) =>
            group.items.some(
              (item) =>
                artifactBranchRowKeyOf({ groupKey: group.key, rowId: item.row.id }) === returnRowId,
            ),
          )
          .map((group) => group.key),
      ),
  );
  const arrivalGroups = useMemo(
    () =>
      view.groups.map((group) => {
        const first = group.items[0];
        return {
          key: group.key,
          firstRowKey:
            first === undefined
              ? null
              : artifactBranchRowKeyOf({ groupKey: group.key, rowId: first.row.id }),
        };
      }),
    [view.groups],
  );
  const onArrive = useCallback(({ groupKey }: ArriveParams) => {
    setOpenGroups((open) => new Set([...open, groupKey]));
  }, []);
  const { revealRow } = useGroupArrival({
    isActive: true,
    rowAttribute: 'data-artifact-row',
    groups: arrivalGroups,
    onArrive,
  });

  const toggle = ({ key }: ToggleParams) => {
    setOpenGroups((open) => {
      const next = new Set(open);
      if (next.has(key)) {
        next.delete(key);
        return next;
      }
      return new Set([...open, key]);
    });
  };

  const reveal = ({ rowId, fromGroupKey }: RevealParams) => {
    const keys = view.groups
      .filter((group) => group.items.some((item) => item.row.id === rowId))
      .map((group) => group.key);
    const groupKey = keys[(keys.indexOf(fromGroupKey) + 1) % keys.length];
    if (groupKey === undefined || groupKey === fromGroupKey) {
      return;
    }
    setOpenGroups((open) => new Set([...open, groupKey]));
    revealRow({ rowKey: artifactBranchRowKeyOf({ groupKey, rowId }) });
  };

  return (
    <>
      {view.groups.map((group) => (
        <ArtifactBranchSection
          key={group.key}
          group={group}
          mounts={mounts}
          sessionId={sessionId}
          isOpen={openGroups.has(group.key)}
          openPartsIds={openPartsIds}
          hasActionColumn={hasActionColumn}
          onToggle={() => toggle({ key: group.key })}
          onReveal={reveal}
          onTogglePartsOf={onTogglePartsOf}
          onOpenRow={onOpenRow}
          onOpenBranch={onOpenBranch}
        />
      ))}
      {view.deleted.length === 0 ? null : (
        <ArtifactListGroup
          group="deleted"
          rows={view.deleted}
          sessionId={sessionId}
          openPartsIds={openPartsIds}
          onTogglePartsOf={onTogglePartsOf}
          onOpenRow={onOpenRow}
          hasActionColumn={hasActionColumn}
        />
      )}
    </>
  );
};
