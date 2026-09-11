import { useState } from 'react';
import { Chip, IconButton, Skeleton, Tooltip, cn, formatError, tintClasses } from '@goodboy/ui';
import type { SessionId, WorkspaceId, WorktreeStatus } from '@goodboy/types';
import type { LensKind, MountDiffStat } from '../../../../../store';
import { useAppStore } from '../../../../../store';
import type { MountRowView } from '../../../../../store/slices/project-mounts/mountRowModel';
import { selectActiveMountId } from '../../../../../store/slices/project-mounts/selectors';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { useToast } from '../../../../../app/components/Toast';
import { useMountRemoteHostKind } from '../../../../worktree/useMountRemoteHostKind';
import { EditorMenu } from '../EditorMenu';
import { MountBranchDecision } from './MountBranchDecision';
import { MountChangeCell } from './MountChangeCell';
import { MountKindGlyph } from './MountKindGlyph';
import { MountRequestAction } from './MountRequestAction';
import { MountRequestLink } from './MountRequestLink';
import { ProjectBranchChip } from './ProjectBranchChip';
import { ProjectSyncControl } from './ProjectSyncControl';
import { ProjectDetachMenu } from './ProjectDetachMenu';
import { RemoveWorktreeAction } from './RemoveWorktreeAction';
import { useProjectActivity } from './useProjectActivity';
import { hasDiffCounts, mountOperationView, mountWorktreeState } from './mountRowState';

type Props = {
  readonly sessionId: SessionId;
  readonly row: MountRowView;
  readonly label: string;
  readonly workspaceId: WorkspaceId | null;
  readonly diffStat: MountDiffStat | null;
  readonly worktreeStatus: WorktreeStatus | null;
  readonly isStatusPending?: boolean;
  readonly hasSeriesColumn?: boolean;
  readonly onSelectLens: (lens: LensKind) => void;
};

const UTILITY_REVEAL =
  'opacity-0 motion-safe:transition-opacity group-hover/mount-row:opacity-100 group-focus-within/mount-row:opacity-100';

const SLOT_BRANCH = 'flex min-w-0 flex-1 items-center gap-1';
const SLOT_SERIES = 'flex w-14 shrink-0 items-center';
const SLOT_SYNC = 'flex w-7 shrink-0 items-center justify-center';
const SLOT_DIFF = 'flex w-24 shrink-0 items-center';
const SLOT_STATE = 'flex w-32 shrink-0 items-center';
const SLOT_ACTION = 'flex w-20 shrink-0 items-center';
const SLOT_UTILITY = 'flex w-28 shrink-0 items-center justify-end';

const ACTIVITY_DOT = cn(
  'pointer-events-none absolute -right-0.5 -top-0.5 size-1.5 rounded-full',
  tintClasses('success').dot,
);

type SuffixParams = {
  readonly count: number;
};

type OpenLensParams = {
  readonly lens: LensKind;
};

const runningSuffix = ({ count }: SuffixParams) => (count > 0 ? `, ${count} running` : '');

export const ProjectMountRow = ({
  sessionId,
  row,
  label,
  workspaceId,
  diffStat,
  worktreeStatus,
  isStatusPending: isStatusPendingProp = false,
  hasSeriesColumn = false,
  onSelectLens,
}: Props) => {
  const setScriptsLensScope = useAppStore((state) => state.setScriptsLensScope);
  const openMountTerminal = useAppStore((state) => state.openMountTerminal);
  const attachMount = useAppStore((state) => state.attachMount);
  const activeMountId = useAppStore((state) => selectActiveMountId({ state, sessionId }));
  const { showToast } = useToast();
  const [isAttaching, setIsAttaching] = useState(false);
  const isRepo = row.projectKind === 'repo';
  const worktreePath = row.worktreePath;
  const changes = hasDiffCounts({ diffStat });
  const isStatusPending = isStatusPendingProp && worktreeStatus == null && isRepo;
  const remoteKind = useMountRemoteHostKind({ sessionId, repoRoot: row.repoRoot });
  const activity = useProjectActivity({
    sessionId,
    projectId: row.projectId,
    workspaceId,
  });
  const observation = row.observation;
  const hasTools = row.isAttached && worktreePath !== null;
  const isWriteDestination = row.isAttached && row.mountId === activeMountId;
  const worktreeState = mountWorktreeState({
    status: worktreeStatus,
    isPending: isStatusPendingProp,
  });
  const operation = mountOperationView({ status: worktreeStatus, label });

  const openLens = ({ lens }: OpenLensParams) => {
    if (lens === 'terminal') {
      if (worktreePath !== null) {
        openMountTerminal(sessionId, worktreePath);
      }
      return;
    }
    if (lens === 'scripts') {
      setScriptsLensScope({ scope: { projectId: row.projectId } });
    }
    onSelectLens(lens);
  };

  const mount = async () => {
    setIsAttaching(true);
    try {
      await attachMount({ sessionId, mountId: row.mountId });
    } catch (error) {
      showToast('error', formatError(error));
    } finally {
      setIsAttaching(false);
    }
  };

  return (
    <li
      data-testid="project-mount-row"
      aria-label={label}
      className="group/mount-row flex w-full flex-col"
    >
      <div className="flex min-h-8 w-full items-center gap-2 rounded-md px-2 py-1 hover:bg-muted/40">
        <div className={SLOT_BRANCH}>
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
              projectId={row.projectId}
              mountId={row.mountId}
              branch={row.branch}
              canSwitch={isRepo && row.isAttached}
            />
          )}
          {isWriteDestination ? (
            <Chip
              tone="primary"
              size="3xs"
              bordered={false}
              label="Next turns"
              title={`Next turns write to ${label} unless changed from the chat header.`}
              className="shrink-0"
            />
          ) : null}
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
        </div>
        {hasSeriesColumn ? (
          <div className={SLOT_SERIES}>
            {row.series === null ? null : (
              <Tooltip content={`Part ${row.series.label} of ${row.series.name}`}>
                <span className="truncate text-3xs tabular-nums text-muted-foreground/70">
                  {`Part ${row.series.label}`}
                </span>
              </Tooltip>
            )}
          </div>
        ) : null}
        <div className={SLOT_SYNC}>
          {isRepo && row.isAttached && !row.isCompleted ? (
            isStatusPending ? (
              <span data-testid="project-distance-skeleton" className="shrink-0">
                <Skeleton className="size-7 rounded-md" />
              </span>
            ) : (
              <ProjectSyncControl
                sessionId={sessionId}
                projectId={row.projectId}
                mountId={row.mountId}
                status={worktreeStatus}
              />
            )
          ) : null}
        </div>
        <div className={SLOT_DIFF}>
          {!row.isAttached || !isRepo ? null : (
            <MountChangeCell
              sessionId={sessionId}
              label={label}
              worktreePath={worktreePath}
              diffStat={diffStat}
              state={worktreeState}
            />
          )}
        </div>
        <div className={SLOT_STATE}>
          {row.isAttached ? (
            <MountRequestLink sessionId={sessionId} row={row} label={label} />
          ) : (
            <Chip
              tone="neutral"
              size="3xs"
              uppercase
              bordered={false}
              icon={<CONCEPT_ICONS.worktree size={9} aria-hidden />}
              label={row.isOnDisk ? 'Files kept' : 'Files gone'}
              title={
                row.isOnDisk
                  ? 'Not mounted. Its files are still on disk.'
                  : 'Not mounted. Its files were removed.'
              }
              className="shrink-0"
            />
          )}
        </div>
        <div className={SLOT_ACTION}>
          {row.isAttached && row.isCompleted && isRepo && worktreePath !== null ? (
            <RemoveWorktreeAction sessionId={sessionId} row={row} label={label} />
          ) : row.isAttached ? (
            <MountRequestAction
              sessionId={sessionId}
              row={row}
              label={label}
              hasChanges={changes}
              remoteKind={remoteKind}
            />
          ) : (
            <button
              type="button"
              disabled={isAttaching}
              aria-label={`Mount ${label}`}
              onClick={() => void mount()}
              className={cn(
                'shrink-0 rounded-md border border-border-soft px-2 py-0.5 text-2xs text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              {isAttaching ? 'Mounting…' : 'Mount'}
            </button>
          )}
        </div>
        <div className={SLOT_UTILITY}>
          {!hasTools || worktreePath === null ? null : (
            <>
              <EditorMenu
                sessionId={sessionId}
                density="compact"
                target={{ name: label, worktreePath }}
                triggerClassName={UTILITY_REVEAL}
              />
              <span
                className={cn(
                  'relative inline-flex shrink-0',
                  activity.liveTerminals > 0 ? 'opacity-100' : UTILITY_REVEAL,
                )}
              >
                <IconButton
                  variant="ghost"
                  icon={CONCEPT_ICONS.terminal}
                  iconSize={ICON_SIZE.row}
                  label={`Open terminal for ${label}`}
                  tooltip={`Open terminal in ${label}${runningSuffix({ count: activity.liveTerminals })}`}
                  onClick={() => openLens({ lens: 'terminal' })}
                  className="size-7"
                />
                {activity.liveTerminals > 0 ? (
                  <span data-testid="terminal-activity-dot" aria-hidden className={ACTIVITY_DOT} />
                ) : null}
              </span>
              <span
                className={cn(
                  'relative inline-flex shrink-0',
                  activity.runningScripts > 0 ? 'opacity-100' : UTILITY_REVEAL,
                )}
              >
                <IconButton
                  variant="ghost"
                  icon={CONCEPT_ICONS.scripts}
                  iconSize={ICON_SIZE.row}
                  label={`Open scripts for ${label}`}
                  tooltip={`Open scripts for ${label}${runningSuffix({ count: activity.runningScripts })}`}
                  onClick={() => openLens({ lens: 'scripts' })}
                  className="size-7"
                />
                {activity.runningScripts > 0 ? (
                  <span data-testid="scripts-activity-dot" aria-hidden className={ACTIVITY_DOT} />
                ) : null}
              </span>
            </>
          )}
          <ProjectDetachMenu
            sessionId={sessionId}
            projectId={row.projectId}
            workspaceId={workspaceId ?? undefined}
            projectName={row.projectName}
            menuLabel={`${label} actions`}
            worktreePath={worktreePath ?? row.lastWorktreePath ?? ''}
            worktreeStatus={worktreeStatus}
            triggerClassName={UTILITY_REVEAL}
            mountId={row.mountId}
            isMountAttached={row.isAttached}
            branch={row.branch}
            canDetachProject={false}
          />
        </div>
      </div>
      {observation === null ? null : (
        <div className="flex flex-col px-2 pb-2">
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
