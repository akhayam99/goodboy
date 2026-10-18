import { useId, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { IconButton, Reveal, SelectableRow, StatusDot, Tooltip, cn } from '@goodboy/ui';
import type { SessionId, WorktreeStatus } from '@goodboy/types';
import type { MountRowView } from '../../../../store/slices/project-mounts/mountRowModel';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { BranchName } from '../../../../features/branch/components/BranchHeader/BranchName';
import { branchRowFactsOf } from '../../../../features/branch/branchRowFactsOf';
import { pullRequestStateToneOf } from '../../../../features/branch/pullRequestStateToneOf';
import { switchBranchMount } from '../../../../features/branch/switchBranchMount';
import type { EntryDiffStat } from '../../../../features/branch/worktreeEntryFacts';
import { useTaskDropState } from '../../../../features/session/hooks/useTaskDropState';
import type { RailTreeNode, RailTreeOpen } from './useRailTreeOpen';
import { useWorktreeCardEntries } from './useWorktreeCardEntries';
import { useWorktreeRowState } from './useWorktreeRowState';
import { WorktreeEntries } from './WorktreeEntries';
import type { EntryShownFact } from './worktreeRowStateOf';
import type { WorktreeCardEntry } from './worktreeCardEntriesOf';

type Props = {
  readonly sessionId: SessionId;
  readonly row: MountRowView;
  readonly tree: RailTreeOpen;
  readonly status: WorktreeStatus | null;
  readonly isShown: boolean;
  readonly isOpened: boolean;
  readonly diff?: EntryDiffStat | null;
};

type NeedsYouParams = {
  readonly entries: ReadonlyArray<WorktreeCardEntry>;
};

const isNeedingYou = ({ entries }: NeedsYouParams): boolean =>
  entries.some(
    (entry) =>
      (entry.tab === 'comments' && entry.fact.tone !== null) ||
      (entry.tab === 'checks' && entry.fact.tone === 'danger'),
  );

const NONE_SHOWN: ReadonlyArray<EntryShownFact> = [];

export const WorktreeRow = ({
  sessionId,
  row,
  tree,
  status,
  isShown,
  isOpened,
  diff = null,
}: Props) => {
  const entriesId = useId();
  const [wasOpened, setWasOpened] = useState(isOpened);
  if (isOpened && !wasOpened) {
    setWasOpened(true);
  }
  const request = row.request;
  const branch = row.branch === '' ? row.mountName : row.branch;
  const path = row.worktreePath ?? row.lastWorktreePath;
  const entries = useWorktreeCardEntries({ sessionId, row, diff });
  const livePath = row.isAttached ? row.worktreePath : null;
  const hasEntries = livePath !== null && entries.length > 0;
  const node: RailTreeNode = {
    kind: 'branch',
    id: row.mountId,
    isOpenByDefault: wasOpened || isNeedingYou({ entries }),
  };
  const isOpen = hasEntries && tree.isOpen(node);
  const shownByEntries = useMemo(
    () =>
      new Set<EntryShownFact>(
        !isOpen
          ? NONE_SHOWN
          : entries.flatMap((entry) =>
              entry.tab === 'comments' || (entry.tab === 'checks' && entry.fact.tone !== null)
                ? [entry.tab]
                : [],
            ),
      ),
    [entries, isOpen],
  );
  const state = useWorktreeRowState({ sessionId, row, status, shownByEntries });
  const facts = branchRowFactsOf({
    branch: row.branch,
    mountName: row.mountName,
    request,
    checks: null,
    behind: null,
    conflicts: null,
  });
  const requestState = facts.state;
  const mark = pullRequestStateToneOf({ state: requestState });
  const StateIcon = mark.icon;
  const number = facts.number ?? '';
  const isDropTarget = row.branch !== '' && row.isAttached && !row.isFinished;
  const dropState = useTaskDropState({ target: { projectId: row.projectId, branch: row.branch } });
  const isDragLive = isDropTarget && dropState !== 'idle';

  return (
    <div
      data-task-drop={isDropTarget ? 'branch' : undefined}
      data-task-project={isDropTarget ? row.projectId : undefined}
      data-task-branch={isDropTarget ? row.branch : undefined}
      data-worktree-open={isOpen ? '' : undefined}
      className={cn(
        'flex min-w-0 flex-col rounded-md',
        isDragLive && dropState === 'over' && 'bg-selected',
        isDragLive && (dropState === 'dim' || dropState === 'refused') && 'opacity-50',
      )}
    >
      <div className="relative flex min-w-0">
        <SelectableRow
          selected={isShown}
          ariaCurrent={isShown ? 'page' : undefined}
          ariaLabel={[row.projectName, branch, number, facts.stateWord, state.reason]
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
          className="h-7 items-center gap-2 pl-5 pr-1 text-ui"
        >
          <StateIcon
            size={ICON_SIZE.row}
            aria-hidden
            data-pr-state={requestState}
            data-pr-tone={mark.tone}
            className={cn('shrink-0', mark.iconClass)}
          />
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
        {hasEntries ? (
          <span className="absolute inset-y-0 -left-1 flex items-center">
            <IconButton
              icon={ChevronRight}
              size="xs"
              label={`${branch} pages`}
              tooltipSide="right"
              aria-expanded={isOpen}
              aria-controls={entriesId}
              data-worktree-toggle=""
              onClick={() => tree.toggle(node)}
              className={cn(
                'text-faint-foreground [&>svg]:motion-safe:transition-transform',
                isOpen && '[&>svg]:rotate-90',
              )}
            />
          </span>
        ) : null}
      </div>
      {livePath === null ? null : (
        <Reveal open={isOpen} id={entriesId}>
          <WorktreeEntries
            sessionId={sessionId}
            mountId={row.mountId}
            worktreePath={livePath}
            branch={branch}
            entries={entries}
          />
        </Reveal>
      )}
    </div>
  );
};
