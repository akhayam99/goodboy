import { useEffect, useMemo, useState } from 'react';
import type { MountId, Session } from '@goodboy/types';
import { Button, ICON_SIZE } from '@goodboy/ui';
import type { MountRowView } from '../../../../../store/slices/project-mounts/mountRowModel';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';
import { useRowReturn } from '../../../../../shared/hooks/useRowReturn';
import { alsoOnOf, type BranchGroup } from '../../../branchGroupsOf';
import { openBranchWork } from '../../../openBranchWork';
import { openBranchWorkTab } from '../../../openBranchWorkTab';
import { useCanOpenBranchWork } from '../../../hooks/useCanOpenBranchWork';
import type { SessionRun } from '../../../sessionRunsOf';
import { RunsByBranch } from '../../SessionWorkspace/parts/RunsGrid/RunsByBranch';
import { openSessionRun } from '../../SessionWorkspace/parts/RunsGrid/openSessionRun';
import { returnFoldKeyOf } from '../../SessionWorkspace/parts/RunsGrid/returnFoldKeyOf';
import { useRunRowRender } from '../../SessionWorkspace/parts/RunsGrid/useRunRowRender';

type Props = {
  readonly session: Session;
  readonly group: BranchGroup;
  readonly mounts: ReadonlyArray<MountRowView>;
  readonly mountPath: string | null;
  readonly label: string;
  readonly onLeave: () => void;
};

type ToggleParams = {
  readonly key: string;
};

type OpenParams = {
  readonly run: SessionRun;
  readonly rowKey: string;
};

type MountParams = {
  readonly mountId: MountId;
};

type RevealParams = {
  readonly run: SessionRun;
  readonly fromGroupKey: string;
};

const Icon = CONCEPT_ICONS.workflows;

export const BranchWorkRuns = ({ session, group, mounts, mountPath, label, onLeave }: Props) => {
  const sessionId = session.id;
  const canOpenBranch = useCanOpenBranchWork({ sessionId });
  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(() => new Set());
  const rowIds = useMemo(
    () => group.runs.map((run) => `${group.key}/${run.id}`),
    [group.key, group.runs],
  );
  const { remember, returnRowId } = useRowReturn({
    listKey: 'branch-work-runs',
    rowIds,
    rowAttribute: 'data-row-key',
  });
  const foldKeyOfReturn = returnFoldKeyOf({ returnRowId, branchGroups: [group] });
  const renderRow = useRunRowRender({
    session,
    onOpen: ({ run, rowKey }: OpenParams) => {
      remember({ rowId: rowKey });
      openSessionRun({ sessionId, run });
      onLeave();
    },
  });

  useEffect(() => {
    if (foldKeyOfReturn === undefined) {
      return;
    }
    setOpenGroups((open) => new Set([...open, foldKeyOfReturn]));
  }, [foldKeyOfReturn]);

  const toggle = ({ key }: ToggleParams) =>
    setOpenGroups((open) => {
      const next = new Set(open);
      if (next.has(key)) {
        next.delete(key);
        return next;
      }
      return new Set([...open, key]);
    });

  const openBranch = ({ mountId }: MountParams) => {
    openBranchWorkTab({ sessionId, mountId });
  };

  const reveal = ({ run, fromGroupKey }: RevealParams) => {
    const next = alsoOnOf({ run, groupKey: fromGroupKey, mounts })[0];
    if (next === undefined) {
      return;
    }
    openBranchWorkTab({ sessionId, mountId: next.mountId });
  };

  return (
    <RunsByBranch
      groups={[group]}
      mounts={mounts}
      openGroups={openGroups}
      onToggleGroup={toggle}
      onOpenBranch={openBranch}
      canOpenBranch={canOpenBranch}
      onRevealRun={reveal}
      renderRow={renderRow}
      heading={{
        label,
        mark: <Icon size={ICON_SIZE.row} aria-hidden className="text-faint-foreground" />,
        action: (
          <Button
            variant="quiet"
            size="xs"
            onClick={() =>
              openBranchWork({ sessionId, lens: 'workflows', groupKey: group.key, mountPath })
            }
          >
            All runs
          </Button>
        ),
      }}
    />
  );
};
