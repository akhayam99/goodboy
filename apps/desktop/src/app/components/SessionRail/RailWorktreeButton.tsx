import { ICON_SIZE, StatusDot } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { switchBranchMount } from '../../../features/branch/switchBranchMount';
import { RailButton } from '../SideColumn/RailButton';
import { railBranchFactsOf } from './railBranchFactsOf';
import { railBranchLabelOf } from './railBranchLabelOf';
import type { RailBranchEntry } from './railBranchesSplitOf';

type Props = {
  readonly sessionId: SessionId;
  readonly entry: RailBranchEntry;
};

export const RailWorktreeButton = ({ sessionId, entry }: Props) => {
  const { row, state, isShown } = entry;
  const facts = railBranchFactsOf({ row });
  const path = facts.path;
  return (
    <RailButton
      id={`worktree-${row.mountId}`}
      icon={facts.mark.icon}
      iconSize={ICON_SIZE.row}
      iconClassName={facts.mark.iconClass}
      label={railBranchLabelOf({ facts, reason: state.reason })}
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
