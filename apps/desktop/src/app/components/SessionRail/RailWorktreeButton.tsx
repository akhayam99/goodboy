import { ICON_SIZE, StatusDot } from '@goodboy/ui';
import type { SessionId, WorktreeStatus } from '@goodboy/types';
import type { MountRowView } from '../../../store/slices/project-mounts/mountRowModel';

import { branchRowFactsOf } from '../../../features/branch/branchRowFactsOf';
import { pullRequestStateToneOf } from '../../../features/branch/pullRequestStateToneOf';
import { switchBranchMount } from '../../../features/branch/switchBranchMount';
import { RailButton } from '../SideColumn/RailButton';
import { useWorktreeRowState } from './SessionLevel/useWorktreeRowState';

type Props = {
  readonly sessionId: SessionId;
  readonly row: MountRowView;
  readonly status: WorktreeStatus | null;
  readonly isShown: boolean;
};

export const RailWorktreeButton = ({ sessionId, row, status, isShown }: Props) => {
  const state = useWorktreeRowState({ sessionId, row, status });
  const facts = branchRowFactsOf({
    branch: row.branch,
    mountName: row.mountName,
    request: row.request,
    checks: null,
    behind: null,
    conflicts: null,
  });
  const path = row.worktreePath ?? row.lastWorktreePath;
  const mark = pullRequestStateToneOf({ state: facts.state });
  return (
    <RailButton
      id={`worktree-${row.mountId}`}
      icon={mark.icon}
      iconSize={ICON_SIZE.row}
      iconClassName={mark.iconClass}
      label={[row.projectName, facts.branch, facts.stateWord, state.reason]
        .filter((part): part is string => part !== null && part !== '')
        .join(', ')}
      isCurrent={isShown}
      isPage
      {...(state.tone !== null && {
        badge: (
          <span aria-hidden className="absolute right-0.5 top-0.5 flex">
            <StatusDot tone={state.tone} size="sm" />
          </span>
        ),
      })}
      onSelect={() => {
        if (path === null) {
          return;
        }
        void switchBranchMount({
          sessionId,
          mountId: row.mountId,
          worktreePath: path,
          mode: 'push',
        });
      }}
    />
  );
};
