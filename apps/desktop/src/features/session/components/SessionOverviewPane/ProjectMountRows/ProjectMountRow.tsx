import { useState } from 'react';
import {
  Chip,
  IconButton,
  Skeleton,
  Tooltip,
  cn,
  tintClasses,
  type OverflowMenuItem,
} from '@goodboy/ui';
import type { SessionId, WorkspaceId, WorktreeStatus } from '@goodboy/types';
import type { LensKind, MountDiffStat } from '../../../../../store';
import { useAppStore } from '../../../../../store';
import type { MountRowView } from '../../../../../store/slices/project-mounts/mountRowModel';
import {
  selectActiveMountId,
  selectTurnMountCount,
} from '../../../../../store/slices/project-mounts/selectors';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { useMountRemoteHostKind } from '../../../../worktree/useMountRemoteHostKind';
import { useEditorMenuItems } from '../useEditorMenuItems';
import { MountBranchDecision } from './MountBranchDecision';
import { MountChangeCell } from './MountChangeCell';
import { MountKindGlyph } from './MountKindGlyph';
import { MountPresence } from './MountPresence';
import { MountRequestAction } from './MountRequestAction';
import { MountRequestLink } from './MountRequestLink';
import { ProjectBranchChip } from './ProjectBranchChip';
import { ProjectSyncControl } from './ProjectSyncControl';
import { MountActionsMenu } from './MountActionsMenu';
import { RemoveWorktreeAction } from './RemoveWorktreeAction';
import { useMountPresence } from './useMountPresence';
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
  readonly onSelectLens: (lens: LensKind) => void;
};

const UTILITY_REVEAL =
  'opacity-0 motion-safe:transition-opacity group-hover/mount-row:opacity-100 group-focus-within/mount-row:opacity-100 @max-md:hidden';

const CELL = 'flex items-center px-1';
const NARROW_HIDDEN = '@max-[36rem]:px-0 @max-[36rem]:*:hidden';

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
  onSelectLens,
}: Props) => {
  const setScriptsLensScope = useAppStore((state) => state.setScriptsLensScope);
  const setSessionActiveMount = useAppStore((state) => state.setSessionActiveMount);
  const openMountTerminal = useAppStore((state) => state.openMountTerminal);
  const attachMount = useAppStore((state) => state.attachMount);
  const activeMountId = useAppStore((state) => selectActiveMountId({ state, sessionId }));
  const turnMountCount = useAppStore((state) => selectTurnMountCount({ state, sessionId }));
  const presence = useMountPresence({ sessionId, mountId: row.mountId });
  const reportError = useAppStore((state) => state.reportError);
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
  const hasTurnChoice = turnMountCount > 1;
  const canStartTurnsHere = hasTools && hasTurnChoice && row.mountId !== activeMountId;
  const worktreeState = mountWorktreeState({
    status: worktreeStatus,
    isPending: isStatusPendingProp,
  });
  const operation = mountOperationView({ status: worktreeStatus, label });
  const editorItems = useEditorMenuItems({ worktreePath: hasTools ? worktreePath : null });

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
      void reportError({ title: `Couldn't reopen ${label}`, error, sessionId });
    } finally {
      setIsAttaching(false);
    }
  };

  const startTurnsHere = async () => {
    try {
      await setSessionActiveMount({ sessionId, mountId: row.mountId });
    } catch (error) {
      void reportError({ title: `Couldn't start new turns in ${label}`, error, sessionId });
    }
  };

  const menuItems: ReadonlyArray<OverflowMenuItem> = hasTools
    ? [
        ...(canStartTurnsHere
          ? [
              {
                kind: 'item',
                key: 'start-turns',
                label: 'Start new turns here',
                onClick: () => void startTurnsHere(),
              } satisfies OverflowMenuItem,
            ]
          : []),
        {
          kind: 'item',
          key: 'terminal',
          label: 'Open terminal',
          icon: CONCEPT_ICONS.terminal,
          onClick: () => openLens({ lens: 'terminal' }),
        },
        {
          kind: 'item',
          key: 'scripts',
          label: 'Open scripts',
          icon: CONCEPT_ICONS.scripts,
          onClick: () => openLens({ lens: 'scripts' }),
        },
        ...editorItems,
      ]
    : [];

  return (
    <li
      data-testid="project-mount-row"
      aria-label={label}
      className="group/mount-row col-span-full grid grid-cols-subgrid"
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
              canSwitch={isRepo && row.isAttached}
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
          {hasTurnChoice && row.isAttached && (
            <MountPresence sessionId={sessionId} label={label} agents={presence} />
          )}
        </div>
        {row.series === null ? (
          <span />
        ) : (
          <div className={CELL}>
            <Tooltip content={`Part ${row.series.label} of ${row.series.name}`}>
              <span className="truncate text-3xs tabular-nums text-faint-foreground">
                {`Part ${row.series.label}`}
              </span>
            </Tooltip>
          </div>
        )}
        {isRepo && row.isAttached && !row.isCompleted ? (
          <div className={cn(CELL, 'justify-center', NARROW_HIDDEN)}>
            {isStatusPending ? (
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
            <MountRequestLink sessionId={sessionId} row={row} label={label} />
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
              aria-label={`Reopen ${label}`}
              onClick={() => void mount()}
              className={cn(
                'shrink-0 rounded-md border border-border-soft px-2 py-0.5 text-2xs text-muted-foreground hover:bg-hover hover:text-foreground',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              {isAttaching ? 'Reopening…' : 'Reopen'}
            </button>
          )}
        </div>
        <div className={cn(CELL, 'justify-end')}>
          {!hasTools ? null : (
            <>
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
          <MountActionsMenu
            sessionId={sessionId}
            projectId={row.projectId}
            workspaceId={workspaceId ?? undefined}
            projectName={row.projectName}
            menuLabel={`${label} actions`}
            worktreePath={worktreePath ?? row.lastWorktreePath ?? ''}
            worktreeStatus={worktreeStatus}
            mountId={row.mountId}
            isMountAttached={row.isAttached}
            branch={row.branch}
            canDetachProject={false}
            items={menuItems}
          />
        </div>
      </div>
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
