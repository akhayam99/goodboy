import { StatusDot } from '@goodboy/ui';
import type { SessionId, WorktreeStatus } from '@goodboy/types';
import type { MountRowView } from '../../../store/slices/project-mounts/mountRowModel';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../shared/components/conceptIcons';
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
  const branch = row.branch === '' ? row.mountName : row.branch;
  const path = row.worktreePath ?? row.lastWorktreePath;
  return (
    <RailButton
      id={`worktree-${row.mountId}`}
      icon={CONCEPT_ICONS.branch}
      iconSize={ICON_SIZE.row}
      label={[row.projectName, branch, state.reason]
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
