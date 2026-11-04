import { GitBranch } from 'lucide-react';
import { ICON_SIZE } from '@goodboy/ui';
import { RailButton, type RailButtonPopup } from '../SideColumn/RailButton';

type Props = {
  readonly count: number;
  readonly onEnter: RailButtonPopup['onEnter'];
  readonly onLeave: RailButtonPopup['onLeave'];
  readonly onKeyDown: RailButtonPopup['onKeyDown'];
};

export const RailBranchesButton = ({ count, onEnter, onLeave, onKeyDown }: Props) => (
  <RailButton
    id="branches"
    icon={GitBranch}
    iconSize={ICON_SIZE.row}
    label={`${count} more ${count === 1 ? 'branch' : 'branches'}`}
    isCurrent={false}
    isPage
    popup={{ onEnter, onLeave, onKeyDown }}
    badge={
      <span
        aria-hidden
        data-rail-branches-count=""
        className="absolute bottom-0 right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-hover px-1 text-chip tabular-nums text-muted-foreground"
      >
        {count}
      </span>
    }
    onSelect={() => undefined}
  />
);
