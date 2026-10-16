import { PULL_REQUEST_NOUNS } from '@goodboy/core';
import { SelectableRow, StatusDot, Tooltip, cn } from '@goodboy/ui';
import type { SessionId, WorktreeStatus } from '@goodboy/types';
import type { MountRowView } from '../../../../store/slices/project-mounts/mountRowModel';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { BranchName } from '../../../../features/branch/components/BranchHeader/BranchName';
import { switchBranchMount } from '../../../../features/branch/switchBranchMount';
import { useTaskDropState } from '../../../../features/session/hooks/useTaskDropState';
import { useWorktreeRowState } from './useWorktreeRowState';

type Props = {
  readonly sessionId: SessionId;
  readonly row: MountRowView;
  readonly status: WorktreeStatus | null;
  readonly isShown: boolean;
};

export const WorktreeRow = ({ sessionId, row, status, isShown }: Props) => {
  const request = row.request;
  const branch = row.branch === '' ? row.mountName : row.branch;
  const path = row.worktreePath ?? row.lastWorktreePath;
  const state = useWorktreeRowState({ sessionId, row, status });
  const number =
    request === null ? '' : `${PULL_REQUEST_NOUNS[request.provider].numberPrefix}${request.number}`;
  const isDropTarget = row.branch !== '' && row.isAttached && !row.isFinished;
  const dropState = useTaskDropState({ target: { projectId: row.projectId, branch: row.branch } });
  const isDragLive = isDropTarget && dropState !== 'idle';

  return (
    <div
      data-task-drop={isDropTarget ? 'branch' : undefined}
      data-task-project={isDropTarget ? row.projectId : undefined}
      data-task-branch={isDropTarget ? row.branch : undefined}
      className={cn(
        'flex min-w-0 flex-col rounded-md',
        isDragLive && dropState === 'over' && 'bg-selected',
        isDragLive && (dropState === 'dim' || dropState === 'refused') && 'opacity-50',
      )}
    >
      <SelectableRow
        selected={isShown}
        ariaCurrent={isShown ? 'page' : undefined}
        ariaLabel={[row.projectName, branch, number, state.reason]
          .filter((part) => part !== null && part !== '')
          .join(', ')}
        {...(path !== null && {
          onClick: () =>
            void switchBranchMount({
              sessionId,
              mountId: row.mountId,
              worktreePath: path,
              mode: 'push',
            }),
        })}
        className="h-7 items-center gap-2 px-2 text-ui"
      >
        <CONCEPT_ICONS.branch size={ICON_SIZE.row} aria-hidden className="shrink-0" />
        <span data-worktree-branch="" className="flex min-w-0 flex-1">
          <BranchName branch={branch} />
        </span>
        {number === '' ? null : (
          <span className="shrink-0 text-right text-meta tabular-nums text-faint-foreground">
            {number}
          </span>
        )}
        <span data-worktree-dot="" className="flex w-2 shrink-0 items-center justify-center">
          {state.tone === null ? null : (
            <Tooltip content={state.reason}>
              <span className="flex">
                <StatusDot tone={state.tone} size="sm" />
              </span>
            </Tooltip>
          )}
        </span>
      </SelectableRow>
    </div>
  );
};
