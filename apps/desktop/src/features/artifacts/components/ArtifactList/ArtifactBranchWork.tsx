import { useEffect, useMemo, useState } from 'react';
import type { MountId, SessionId } from '@goodboy/types';
import { useRowReturn } from '../../../../shared/hooks/useRowReturn';
import { agentPlace, EMPTY_ARRAY, useAppStore } from '../../../../store';
import { alsoOnBranchesOf } from '../../../session/branchGroupsOf';
import type { BranchWorkHeading } from '../../../session/branchWorkHeading';
import { openBranchWorkTab } from '../../../session/openBranchWorkTab';
import { artifactBranchRowKeyOf } from '../../artifactBranchRowKeys';
import type { ArtifactBranchWork as Work } from '../../hooks/useArtifactBranchGroup';
import { openArtifactPage } from '../../openArtifactPage';
import type { ArtifactOpenParams } from './artifactBranchProps';
import { ArtifactWorkGroup } from './ArtifactWorkGroup';
import { useArtifactParts } from './useArtifactParts';

type Props = {
  readonly sessionId: SessionId;
  readonly work: Work;
  readonly heading: BranchWorkHeading;
  readonly onLeave: () => void;
};

type OpenBranchParams = {
  readonly mountId: MountId;
};

type RevealParams = {
  readonly rowId: string;
  readonly fromGroupKey: string;
};

export const ArtifactBranchWork = ({ sessionId, work, heading, onLeave }: Props) => {
  const { openPartsIds, toggleParts } = useArtifactParts();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useAppStore((s) => s.navigate);
  const projectMounts = useAppStore((s) => s.sessionProjectMounts[sessionId] ?? EMPTY_ARRAY);
  const canOpenBranch = ({ mountId }: OpenBranchParams) =>
    projectMounts.some((mount) => mount.mountId === mountId);
  const { group, mounts } = work;
  const rowIds = useMemo(
    () =>
      group === null
        ? []
        : group.items.map((item) =>
            artifactBranchRowKeyOf({ groupKey: group.key, rowId: item.row.id }),
          ),
    [group],
  );
  const { remember, returnRowId } = useRowReturn({
    listKey: 'branch-work-artifacts',
    rowIds,
    rowAttribute: 'data-row-key',
  });
  const isReturnUsed =
    group !== null &&
    returnRowId !== null &&
    group.items.some(
      (item) =>
        item.row.group === 'consumed' &&
        artifactBranchRowKeyOf({ groupKey: group.key, rowId: item.row.id }) === returnRowId,
    );

  useEffect(() => {
    if (isReturnUsed) {
      setIsOpen(true);
    }
  }, [isReturnUsed]);

  if (group === null) {
    return null;
  }

  const openRow = ({ row, rowKey }: ArtifactOpenParams) => {
    remember({ rowId: rowKey });
    if (row.target.kind === 'artifact') {
      openArtifactPage({ sessionId, artifactId: row.target.artifactId });
      onLeave();
      return;
    }
    navigate({ to: agentPlace({ sessionId, agentId: row.target.generation.agentId }) });
    onLeave();
  };

  const reveal = ({ rowId, fromGroupKey }: RevealParams) => {
    const item = group.items.find((candidate) => candidate.row.id === rowId);
    const next =
      item === undefined
        ? undefined
        : alsoOnBranchesOf({ branches: item.branches, groupKey: fromGroupKey, mounts })[0];
    if (next === undefined) {
      return;
    }
    openBranchWorkTab({ sessionId, mountId: next.mountId });
  };

  return (
    <ArtifactWorkGroup
      group={group}
      mounts={mounts}
      sessionId={sessionId}
      isOpen={isOpen}
      openPartsIds={openPartsIds}
      heading={heading}
      onToggle={() => setIsOpen((wasOpen) => !wasOpen)}
      onReveal={reveal}
      canOpenBranch={canOpenBranch}
      onTogglePartsOf={toggleParts}
      onOpenRow={openRow}
    />
  );
};
