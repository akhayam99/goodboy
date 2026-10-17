import { StatusDot } from '@goodboy/ui';
import type { SessionId, WorktreeStatus } from '@goodboy/types';
import type { MountRowView } from '../../../store/slices/project-mounts/mountRowModel';
import { ICON_SIZE } from '../../../shared/components/conceptIcons';
import { pullRequestStateToneOf } from '../../../features/branch/pullRequestStateToneOf';
import { pullRequestStateWordOf } from '../../../features/branch/pullRequestStateWordOf';
import { switchBranchMount } from '../../../features/branch/switchBranchMount';
import { RailButton } from '../SideColumn/RailButton';
import { requestStateOf } from './SessionLevel/requestStateOf';
import { useWorktreeRowState } from './SessionLevel/useWorktreeRowState';

type Props = {
  readonly sessionId: SessionId;
  readonly row: MountRowView;
  readonly status: WorktreeStatus | null;
  readonly isShown: boolean;
};

export const RailWorktreeButton = ({ sessionId, row, status, isShown }: Props) => {
  const state = useWorktreeRowState({ sessionId, row, status });
  const branch = row.branch === '' ? row.mountName : row.branch;
  const path = row.worktreePath ?? row.lastWorktreePath;
  const requestState = requestStateOf({ request: row.request });
  const mark = pullRequestStateToneOf({ state: requestState });
  return (
    <RailButton
      id={`worktree-${row.mountId}`}
      icon={mark.icon}
      iconSize={ICON_SIZE.row}
      iconClassName={mark.iconClass}
      label={[
        row.projectName,
        branch,
        pullRequestStateWordOf({ state: requestState }),
        state.reason,
      ]
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
