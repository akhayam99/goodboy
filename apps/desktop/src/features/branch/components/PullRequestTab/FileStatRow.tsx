import { ROW_INTERACTIVE, cn } from '@goodboy/ui';
import type { PullRequestFileStat } from '@goodboy/types';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { PROPERTY_ROW } from './propertyRow';

type Props = {
  readonly stat: PullRequestFileStat;
  readonly onOpen: () => void;
};

export const FileStatRow = ({ stat, onOpen }: Props) => (
  <li className="min-w-0">
    <button
      type="button"
      title={stat.path}
      onClick={onOpen}
      className={cn(PROPERTY_ROW, 'w-full rounded-md px-1 text-left', ROW_INTERACTIVE)}
    >
      <CONCEPT_ICONS.diff
        size={ICON_SIZE.row}
        aria-hidden
        className="shrink-0 text-faint-foreground"
      />
      <span className="min-w-0 flex-1 truncate text-code text-muted-foreground">
        {stat.path.split('/').pop() ?? stat.path}
      </span>
      <span className="shrink-0 text-meta tabular-nums">
        <span className="text-success">+{stat.additions}</span>{' '}
        <span className="text-danger">-{stat.deletions}</span>
      </span>
    </button>
  </li>
);
