import { useId, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Reveal, cn } from '@goodboy/ui';
import type { SessionId, WorktreeStatus } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { branchScopeOf } from '../../../../store/slices/session-view/branchScopeOf';
import type { MountRowView } from '../../../../store/slices/project-mounts/mountRowModel';
import { mainBehindOf, unmergedCount } from '../../../../shared/lib/gitStatus';
import { useObjectMenuTrigger } from '../../../../features/actions/useObjectMenuTrigger';
import { ObjectOverflowMenu } from '../../../../features/actions/components/ObjectOverflowMenu';
import { ROW_MENU_TOOLTIP } from '../../../../features/actions/rowMenuTooltip';
import { useMountMenuTarget } from '../../../../features/session/hooks/useMountMenuTarget';
import { branchRowFactsOf } from '../../../../features/branch/branchRowFactsOf';
import { resolveBranchTab, type BranchScope } from '../../../../features/branch/branchTabs';
import { useBranchTab } from '../../../../features/branch/hooks/useBranchTab';
import { switchBranchMount } from '../../../../features/branch/switchBranchMount';
import type { EntryDiffStat } from '../../../../features/branch/worktreeEntryFacts';
import { rebaseAllBranchOf } from '../../../../features/history/RebaseAllCard/rebaseAllBranchOf';
import { isRebasedBranchSettled } from '../../../../features/history/RebaseAllCard/rebaseAllBatchSettledOf';
import { rebaseProgressTextOf } from '../../../../features/history/RebaseAllCard/rebaseProgressTextOf';
import { useTaskDropState } from '../../../../features/session/hooks/useTaskDropState';
import { TRAIL_SLOT } from '../../../../shared/components/trailingSlot';
import { BranchRowAnchors } from './BranchRowAnchors';
import { BranchRowLine } from './BranchRowLine';
import { BranchStatusLine } from './BranchStatusLine';
import { branchRowChipOf } from './branchRowChipOf';
import type { RailTreeNode, RailTreeOpen } from './useRailTreeOpen';
import { useWorktreeCardEntries } from './useWorktreeCardEntries';
import { useWorktreeRowState } from './useWorktreeRowState';
import { requestStateOf } from './requestStateOf';
import { WorktreeEntries } from './WorktreeEntries';

type Props = {
  readonly sessionId: SessionId;
  readonly row: MountRowView;
  readonly tree: RailTreeOpen;
  readonly status: WorktreeStatus | null;
  readonly isShown: boolean;
  readonly isOpened: boolean;
  readonly isBatchSettled: boolean;
  readonly diff?: EntryDiffStat | null;
};

const NO_FILES: ReadonlyArray<string> = [];

export const WorktreeRow = ({
  sessionId,
  row,
  tree,
  status,
  isShown,
  isOpened,
  isBatchSettled,
  diff = null,
}: Props) => {
  const entriesId = useId();
  const path = row.worktreePath ?? row.lastWorktreePath;
  const sessionScope = useAppStore(
    useShallow((state) => branchScopeOf({ state, sessionId, mountId: row.mountId })),
  );
  const ownState = requestStateOf({ request: row.request });
  const scope = useMemo<BranchScope>(
    () => ({
      state: ownState === 'none' ? sessionScope.state : ownState,
      hasComments: sessionScope.hasComments,
    }),
    [ownState, sessionScope.hasComments, sessionScope.state],
  );
  const { entries, runs } = useWorktreeCardEntries({
    sessionId,
    row,
    diff,
    scope: isOpened ? scope : null,
    status,
  });
  const livePath = row.isAttached ? row.worktreePath : null;
  const hasEntries = livePath !== null && entries.length > 0;
  const node: RailTreeNode = { kind: 'branch', id: row.mountId, isOpenByDefault: true };
  const isOpen = hasEntries && isOpened && tree.isOpen(node);
  const behind = mainBehindOf({ status, isDone: row.isFinished });
  const conflicts =
    status === null || row.isFinished ? null : unmergedCount({ workingTree: status.workingTree });
  const facts = branchRowFactsOf({
    branch: row.branch,
    mountName: row.mountName,
    request: row.request,
    checks: runs,
    behind,
    conflicts,
  });
  const storedTab = useBranchTab({ sessionId, mountPath: row.worktreePath });
  const currentTab = isShown ? resolveBranchTab({ tab: storedTab, scope }) : null;
  const rebase = useAppStore((state) =>
    rebaseAllBranchOf({ run: state.rebaseAllRuns[sessionId] ?? null, mountId: row.mountId }),
  );
  const progress = useAppStore((state) =>
    rebase?.state === 'rebasing'
      ? rebaseProgressTextOf({ historyRun: state.historyRuns[row.mountId] ?? null })
      : null,
  );
  const conflictFiles = useAppStore(
    (state) => state.historyRuns[row.mountId]?.stop?.files ?? NO_FILES,
  );
  const chip = branchRowChipOf({
    signal: facts.signal,
    rebase,
    isSettled: isRebasedBranchSettled({ status: status ?? undefined }),
    isRebaseStopped: !row.isFinished && status?.inProgress === 'rebase',
    isBatchSettled,
    progress,
    conflictFiles,
  });
  const state = useWorktreeRowState({ sessionId, row, status });
  const reason = chip === null ? state.reason : null;
  const target = useMountMenuTarget({ sessionId, mountId: row.mountId });
  const menu = useObjectMenuTrigger({ target, anchorKey: `mount-${row.mountId}` });
  const isDropTarget = row.branch !== '' && row.isAttached && !row.isFinished;
  const dropState = useTaskDropState({ target: { projectId: row.projectId, branch: row.branch } });
  const isDragLive = isDropTarget && dropState !== 'idle';
  const select = () => {
    if (!isOpened && path !== null) {
      void switchBranchMount({
        sessionId,
        mountId: row.mountId,
        worktreePath: path,
        mode: 'push',
      });
      if (hasEntries) {
        tree.open(node);
      }
      return;
    }
    if (hasEntries) {
      tree.toggle(node);
    }
  };

  return (
    <div
      data-task-drop={isDropTarget ? 'branch' : undefined}
      data-task-project={isDropTarget ? row.projectId : undefined}
      data-task-branch={isDropTarget ? row.branch : undefined}
      data-worktree-open={isOpen ? '' : undefined}
      data-worktree-current={isOpened ? '' : undefined}
      className={cn(
        'flex min-w-0 flex-col rounded-md',
        isDragLive && dropState === 'over' && 'bg-selected',
        isDragLive && (dropState === 'dim' || dropState === 'refused') && 'opacity-50',
      )}
    >
      <div
        onContextMenu={menu.onContextMenu}
        onKeyDown={menu.onKeyDown}
        data-row-opened={isOpened ? '' : undefined}
        className="group/row relative flex min-w-0 items-center"
      >
        <BranchRowLine
          facts={facts}
          chip={chip}
          ariaLabel={[facts.label, reason].filter((part) => part !== null).join(', ')}
          reason={reason}
          isShown={isShown}
          isExpanded={hasEntries && isOpened ? isOpen : undefined}
          onSelect={path === null ? undefined : select}
        />
        <span
          data-worktree-actions=""
          data-actions-at-rest={isOpened ? 'shown' : 'hidden'}
          className={cn(
            TRAIL_SLOT,
            'absolute inset-y-0 right-0 my-auto',
            !isOpened && 'row-actions',
          )}
        >
          <ObjectOverflowMenu
            target={target}
            label={`${row.projectName} · ${facts.branch} actions`}
            tooltip={ROW_MENU_TOOLTIP}
            size="compact"
            hideWhenEmpty
          />
        </span>
      </div>
      <BranchRowAnchors sessionId={sessionId} row={row} />
      {isOpened ? (
        <BranchStatusLine sessionId={sessionId} row={row} status={status} target={target} />
      ) : null}
      {livePath === null || !isOpened ? null : (
        <Reveal open={isOpen} id={entriesId}>
          <WorktreeEntries
            sessionId={sessionId}
            worktreePath={livePath}
            branch={facts.branch}
            number={facts.number}
            currentTab={currentTab}
            entries={entries}
            target={target}
          />
        </Reveal>
      )}
    </div>
  );
};
