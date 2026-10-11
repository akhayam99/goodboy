import { useMemo } from 'react';
import { Unlink, X } from 'lucide-react';
import { EmptyLine, Chip, Skeleton, SkeletonChip, cn } from '@goodboy/ui';
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
import { PutOnBranchPopover } from '../../TaskPlacement/PutOnBranchPopover';
import { BranchTaskChips } from './BranchTaskChips';
import { MountActionFailureNotice } from './MountActionFailureNotice';
import { MountBranchDecision } from './MountBranchDecision';
import { MountChangeCell } from './MountChangeCell';
import { MountKindGlyph } from './MountKindGlyph';
import { MountPresence } from './MountPresence';
import { MountRequestLink } from './MountRequestLink';
import { ForeignCommitsNotice } from './ForeignCommitsNotice';
import { MountResolveLink } from './MountResolveLink';
import { MountStatusPhrase } from './MountStatusPhrase';
import { ProjectBranchChip } from './ProjectBranchChip';
import { RebaseStoppedNotice } from './RebaseStoppedNotice';
import { MountConfirmAction } from './MountConfirmAction';
import { MountRowAction } from './MountRowAction';
import { RemoveWorktreeAction } from './RemoveWorktreeAction';
import { useMountPresence } from './useMountPresence';
import { mountWorktreeState } from './mountRowState';
import { MOUNT_CHILD_PAD, MOUNT_ROW_HEIGHT, MOUNT_ROW_PAD } from './mountGrid';

type Props = {
  readonly sessionId: SessionId;
  readonly row: MountRowView;
  readonly label: string;
  readonly diffStat: MountDiffStat | null;
  readonly worktreeStatus: WorktreeStatus | null;
  readonly isStatusPending?: boolean;
  readonly commitsAfterMerge?: number | null;
  readonly isSkeleton?: boolean;
};

export const ProjectMountRow = ({
  sessionId,
  row,
  label,
  diffStat,
  worktreeStatus,
  isStatusPending: isStatusPendingProp = false,
  commitsAfterMerge = null,
  isSkeleton = false,
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
  const isPutTaskShown = row.branch !== '' && row.isAttached && !row.isFinished;
  const hasInlineClose = controls
    .inSlot({ slot: 'inline' })
    .some((action) => action.id === 'mount.close');
  const isRemoveShown = row.isAttached && (row.isFinished || hasInlineClose);
  const menuOmit = useMemo(
    () => [
      ...controls.actions
        .filter((action) => action.slot === 'inline' || action.id === 'mount.putTaskOnBranch')
        .map((action) => action.id),
      'mount.close',
      'mount.forget',
    ],
    [controls.actions],
  );
  const switchBranch =
    controls.actions.find((action) => action.id === 'mount.switchBranch') ?? null;

  return (
    <li
      data-testid="project-mount-row"
      aria-label={label}
      data-finished={row.isFinished ? 'true' : undefined}
      className="group/mount-row col-span-full grid grid-cols-subgrid"
      onContextMenu={menuTrigger.onContextMenu}
      onKeyDown={menuTrigger.onKeyDown}
    >
      <div
        data-testid="project-mount-cells"
        data-slot="mount-child"
        data-row-height={MOUNT_ROW_HEIGHT}
        style={{
          height: MOUNT_ROW_HEIGHT,
          paddingLeft: MOUNT_CHILD_PAD,
          paddingRight: MOUNT_ROW_PAD,
        }}
        className={cn(
          'col-span-full grid grid-cols-subgrid items-center gap-x-3 rounded-md hover:bg-hover',
          row.isFinished && 'opacity-70 hover:opacity-100',
        )}
      >
        <div className="flex h-full min-w-0 items-center gap-x-2">
          <div
            data-testid="project-mount-branch-cell"
            className="flex min-w-0 flex-1 items-center gap-x-2 overflow-hidden"
          >
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
            {row.branch === '' ? null : (
              <BranchTaskChips
                sessionId={sessionId}
                projectId={row.projectId}
                branch={row.branch}
                isSkeleton={isSkeleton}
              />
            )}
            {row.branch === '' || row.isFinished ? null : (
              <MountStatusPhrase
                label={label}
                status={worktreeStatus}
                series={row.series}
                isRepo={isRepo && row.isAttached}
                isPending={isStatusPending}
                isSkeleton={isSkeleton}
                isRebasing={controls.pendingId === 'mount.rebase'}
                commitsAfterMerge={commitsAfterMerge}
                request={row.request}
              />
            )}
            {row.isAttached ? (
              <MountResolveLink sessionId={sessionId} row={row} label={label} />
            ) : null}
            {isRepo && row.branch !== '' ? (
              <AlsoInChip sessionId={sessionId} projectId={row.projectId} branch={row.branch} />
            ) : null}
            {hasTurnChoice && row.isAttached && (
              <MountPresence sessionId={sessionId} label={label} agents={presence} />
            )}
          </div>
          {!isPutTaskShown ? null : (
            <span className="pointer-events-none flex shrink-0 items-center group-focus-within/mount-row:pointer-events-auto group-hover/mount-row:pointer-events-auto">
              <PutOnBranchPopover
                sessionId={sessionId}
                mountId={row.mountId}
                projectId={row.projectId}
                branch={row.branch}
              />
            </span>
          )}
        </div>
        <div className="flex min-w-0 items-center gap-1 overflow-hidden">
          {isSkeleton && row.isAttached ? (
            <SkeletonChip width="lg" />
          ) : row.isAttached ? (
            <>
              <MountRequestLink sessionId={sessionId} row={row} label={label} />
              {row.request === null && isRepo && !row.isFinished && !row.isMainCheckout ? (
                <EmptyLine className="px-2 text-label text-faint-foreground">No PR yet</EmptyLine>
              ) : null}
            </>
          ) : (
            <Chip
              tone="neutral"
              kind="state"
              bordered={false}
              icon={<CONCEPT_ICONS.worktree size={ICON_SIZE.mark} aria-hidden />}
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
        <div className="flex min-w-0 items-center overflow-hidden">
          {!row.isAttached || !isRepo ? null : isSkeleton ? (
            <Skeleton className="h-3.5 w-16" />
          ) : (
            <MountChangeCell
              sessionId={sessionId}
              label={label}
              worktreePath={worktreePath}
              diffStat={diffStat}
              state={worktreeState}
            />
          )}
        </div>
        <div className="flex min-w-0 items-center justify-end gap-1">
          {isSkeleton ? (
            <SkeletonChip width="sm" />
          ) : (
            <>
              {isRemoveShown ? (
                <RemoveWorktreeAction sessionId={sessionId} row={row} label={label} />
              ) : (
                <MountRowAction label={label} controls={controls} />
              )}
              {isRemoveShown || !row.isAttached ? null : (
                <MountConfirmAction
                  controls={controls}
                  actionId="mount.close"
                  label={label}
                  glyph={X}
                />
              )}
              {row.isAttached ? null : (
                <MountConfirmAction
                  controls={controls}
                  actionId="mount.forget"
                  label={label}
                  glyph={Unlink}
                />
              )}
            </>
          )}
          <ObjectOverflowMenu
            target={target}
            label={`${label} actions`}
            size="control"
            omit={menuOmit}
            hideWhenEmpty
          />
        </div>
      </div>
      {controls.failure === null ? null : (
        <div className="col-span-full flex flex-col px-2 pb-2">
          <MountActionFailureNotice projectName={row.projectName} controls={controls} />
        </div>
      )}
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
      {isRepo && hasTools ? (
        <div className="col-span-full flex flex-col px-2 empty:hidden">
          <ForeignCommitsNotice sessionId={sessionId} row={row} status={worktreeStatus} />
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
