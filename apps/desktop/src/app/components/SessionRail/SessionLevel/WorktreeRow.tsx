import { PULL_REQUEST_NOUNS } from '@goodboy/core';
import { SelectableRow, StatusDot, Tooltip, cn } from '@goodboy/ui';
import type { SessionId, WorktreeStatus } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import type { MountRowView } from '../../../../store/slices/project-mounts/mountRowModel';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { distanceBehind, unmergedCount } from '../../../../shared/lib/gitStatus';
import { switchBranchMount } from '../../../../features/branch/switchBranchMount';
import { mountReviewGithub } from '../../../../features/review/mountReviewGithub';
import { eligibleReviewThreadCount } from '../../../../features/suggestions/eligibleThreads';
import { useTaskDropState } from '../../../../features/session/hooks/useTaskDropState';
import { worktreeRowStateOf } from './worktreeRowStateOf';

type Props = {
  readonly sessionId: SessionId;
  readonly row: MountRowView;
  readonly status: WorktreeStatus | null;
  readonly isShown: boolean;
};

export const WorktreeRow = ({ sessionId, row, status, isShown }: Props) => {
  const request = row.request;
  const prNumber = request?.provider === 'github' ? request.number : null;
  const commentsWaiting = useAppStore((state) => {
    if (prNumber === null) {
      return 0;
    }
    const github = mountReviewGithub({ state, sessionId, mountId: row.mountId });
    if (github?.pr?.number !== prNumber) {
      return 0;
    }
    return eligibleReviewThreadCount({
      github,
      rows: state.sessionResolveThreads[sessionId] ?? EMPTY_ARRAY,
    });
  });
  const branch = row.branch === '' ? row.mountName : row.branch;
  const path = row.worktreePath ?? row.lastWorktreePath;
  const state = worktreeRowStateOf({
    checks: request?.checks ?? null,
    behind: status === null ? null : distanceBehind({ distance: status.mainDistance }),
    conflicts: status === null ? null : unmergedCount({ workingTree: status.workingTree }),
    isRebasing: status?.inProgress === 'rebase',
    isDecisionWaiting: row.observation !== null,
    commentsWaiting,
    baseBranch: row.baseBranch,
  });
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
        className="h-7 items-center gap-2 px-2 text-label"
      >
        <CONCEPT_ICONS.branch size={ICON_SIZE.row} aria-hidden className="shrink-0" />
        <span data-worktree-branch="" className="min-w-0 flex-1 truncate text-code">
          {branch}
        </span>
        <span className="w-12 shrink-0 text-right text-meta tabular-nums text-faint-foreground">
          {number}
        </span>
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
