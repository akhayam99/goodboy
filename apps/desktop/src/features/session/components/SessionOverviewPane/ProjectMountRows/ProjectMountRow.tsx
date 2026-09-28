import { useMemo } from 'react';
import { Chip, Skeleton, Tooltip, cn } from '@goodboy/ui';
import type { SessionId, WorktreeStatus } from '@goodboy/types';
import type { MountDiffStat } from '../../../../../store';
import type { MountRowView } from '../../../../../store/slices/project-mounts/mountRowModel';
import { selectTurnMountCount } from '../../../../../store/slices/project-mounts/selectors';
import { useAppStore } from '../../../../../store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { ObjectOverflowMenu } from '../../../../actions/components/ObjectOverflowMenu';
import { useActionControls } from '../../../../actions/useActionControls';
import { useObjectMenuTrigger } from '../../../../actions/useObjectMenuTrigger';
import type { MountActionTarget } from '../../../../actions/types';
import { useMountRemoteHostKind } from '../../../../worktree/useMountRemoteHostKind';
import { AlsoInChip } from './AlsoInChip';
import { BranchPresenceLabel } from './BranchPresenceLabel';
import { MainDistanceLabel } from './MainDistanceLabel';
import { MountBranchDecision } from './MountBranchDecision';
import { MountChangeCell } from './MountChangeCell';
import { MountKindGlyph } from './MountKindGlyph';
import { MountPresence } from './MountPresence';
import { MountRequestLink } from './MountRequestLink';
import { MountResolveLink } from './MountResolveLink';
import { ProjectBranchChip } from './ProjectBranchChip';
import { RebaseStoppedNotice } from './RebaseStoppedNotice';
import { MountRowAction } from './MountRowAction';
import { useMountPresence } from './useMountPresence';
import { mountOperationView, mountWorktreeState } from './mountRowState';

type Props = {
  readonly sessionId: SessionId;
  readonly row: MountRowView;
  readonly label: string;
  readonly diffStat: MountDiffStat | null;
  readonly worktreeStatus: WorktreeStatus | null;
  readonly isStatusPending?: boolean;
  readonly isMerged?: boolean;
  readonly commitsAfterMerge?: number | null;
};

const CELL = 'flex items-center px-1';
const NARROW_HIDDEN = '@max-[36rem]:px-0 @max-[36rem]:*:hidden';

export const ProjectMountRow = ({
  sessionId,
  row,
  label,
  diffStat,
  worktreeStatus,
  isStatusPending: isStatusPendingProp = false,
  isMerged = false,
  commitsAfterMerge = null,
}: Props) => {
  const turnMountCount = useAppStore((state) => selectTurnMountCount({ state, sessionId }));
  const presence = useMountPresence({ sessionId, mountId: row.mountId });
  const isRepo = row.projectKind === 'repo';
  const worktreePath = row.worktreePath;
  const isStatusPending = isStatusPendingProp && worktreeStatus == null && isRepo;
  const remoteKind = useMountRemoteHostKind({ sessionId, repoRoot: row.repoRoot });
  const observation = row.observation;
  const hasTools = row.isAttached && worktreePath !== null;
  const hasTurnChoice = turnMountCount > 1;
  const worktreeState = mountWorktreeState({
    status: worktreeStatus,
    isPending: isStatusPendingProp,
  });
  const operation = mountOperationView({ status: worktreeStatus, label });
  const target = useMemo<MountActionTarget>(
    () => ({
      kind: 'mount',
      sessionId,
      mountId: row.mountId,
      status: worktreeStatus,
      remoteKind,
    }),
    [remoteKind, row.mountId, sessionId, worktreeStatus],
  );
  const controls = useActionControls({ target });
  const menuTrigger = useObjectMenuTrigger({ target });
  const switchBranch =
    controls.actions.find((action) => action.id === 'mount.switchBranch') ?? null;

  return (
    <li
      data-testid="project-mount-row"
      aria-label={label}
      className="group/mount-row col-span-full grid grid-cols-subgrid"
      onContextMenu={menuTrigger.onContextMenu}
      onKeyDown={menuTrigger.onKeyDown}
    >
      <div
        data-testid="project-mount-cells"
        className="col-span-full grid min-h-8 grid-cols-subgrid items-center rounded-md px-1 py-1 hover:bg-hover"
      >
        <div className={cn(CELL, 'min-w-0 gap-1')}>
          <MountKindGlyph
            projectKind={row.projectKind}
            isMainCheckout={row.isMainCheckout}
            label={label}
          />
          {isStatusPending && row.branch === '' ? (
            <span data-testid="project-branch-skeleton" className="shrink-0">
              <Skeleton className="h-6 w-28 rounded-md" />
            </span>
          ) : (
            <ProjectBranchChip
              sessionId={sessionId}
              mountId={row.mountId}
              branch={row.branch}
              canSwitch={switchBranch !== null}
              blockedReason={switchBranch?.blockedReason ?? null}
            />
          )}
          {operation === null ? null : (
            <Chip
              tone="warning"
              size="3xs"
              bordered={false}
              label={operation.label}
              title={operation.title}
              className="shrink-0"
            />
          )}
          {isRepo && row.branch !== '' ? (
            <BranchPresenceLabel
              status={worktreeStatus}
              isMerged={isMerged}
              commitsAfterMerge={commitsAfterMerge}
            />
          ) : null}
          {isRepo && row.branch !== '' ? (
            <AlsoInChip sessionId={sessionId} projectId={row.projectId} branch={row.branch} />
          ) : null}
          {hasTurnChoice && row.isAttached && (
            <MountPresence sessionId={sessionId} label={label} agents={presence} />
          )}
        </div>
        {row.series === null ? (
          <span />
        ) : (
          <div className={CELL}>
            <Tooltip content={`Part ${row.series.label} of ${row.series.name}`}>
              <span className="truncate text-meta text-faint-foreground">
                {`Part ${row.series.label}`}
              </span>
            </Tooltip>
          </div>
        )}
        {isRepo && row.isAttached && !row.isCompleted ? (
          <div className={cn(CELL, 'justify-center', NARROW_HIDDEN)}>
            {isStatusPending ? (
              <span data-testid="project-distance-skeleton" className="shrink-0">
                <Skeleton className="h-5 w-20 rounded-md" />
              </span>
            ) : (
              <MainDistanceLabel
                status={worktreeStatus}
                isRebasing={controls.pendingId === 'mount.rebase'}
              />
            )}
          </div>
        ) : (
          <span />
        )}
        {!row.isAttached || !isRepo ? (
          <span />
        ) : (
          <div className={cn(CELL, NARROW_HIDDEN)}>
            <MountChangeCell
              sessionId={sessionId}
              label={label}
              worktreePath={worktreePath}
              diffStat={diffStat}
              state={worktreeState}
            />
          </div>
        )}
        <div className={CELL}>
          {row.isAttached ? (
            <span className="flex min-w-0 items-center gap-1">
              <MountRequestLink sessionId={sessionId} row={row} label={label} />
              <MountResolveLink sessionId={sessionId} row={row} label={label} />
            </span>
          ) : (
            <Chip
              tone="neutral"
              size="3xs"
              bordered={false}
              icon={<CONCEPT_ICONS.worktree size={9} aria-hidden />}
              label={row.isOnDisk ? 'Files kept' : 'Files gone'}
              title={
                row.isOnDisk
                  ? 'Closed. Its files are still on disk.'
                  : 'Closed. Its files were removed.'
              }
              className="shrink-0"
            />
          )}
        </div>
        <div className={CELL}>
          <MountRowAction sessionId={sessionId} row={row} label={label} controls={controls} />
        </div>
        <div className={cn(CELL, 'justify-end')}>
          <ObjectOverflowMenu
            target={target}
            label={`${label} actions`}
            trigger={<CONCEPT_ICONS.more size={ICON_SIZE.row} aria-hidden />}
            triggerClassName="flex size-7 items-center justify-center"
          />
        </div>
      </div>
      {isRepo && hasTools && worktreeStatus?.inProgress === 'rebase' ? (
        <div className="col-span-full flex flex-col px-2 pb-2">
          <RebaseStoppedNotice
            sessionId={sessionId}
            mountId={row.mountId}
            worktreePath={worktreePath}
            baseBranch={row.baseBranch}
            status={worktreeStatus}
            onOpenTerminal={() => controls.trigger({ actionId: 'mount.openTerminal' })}
          />
        </div>
      ) : null}
      {observation === null ? null : (
        <div className="col-span-full flex flex-col px-2 pb-2">
          <MountBranchDecision
            sessionId={sessionId}
            mountId={row.mountId}
            projectName={row.projectName}
            repoRoot={row.repoRoot}
            worktreePath={row.worktreePath}
            observation={observation}
            holder={row.observedBranchHolder}
          />
        </div>
      )}
    </li>
  );
};
