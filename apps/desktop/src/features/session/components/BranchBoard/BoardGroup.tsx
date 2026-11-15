import { CircleAlert } from 'lucide-react';
import { Button, ICON_SIZE } from '@goodboy/ui';
import type { VisibleGroup } from '../../central/board/visibleGroupsOf';
import { BoardMergeInOrder } from './BoardMergeInOrder';
import { BoardRemoveButton } from './BoardRemoveButton';
import { BoardRow } from './BoardRow';
import { useBoardContext } from './useBoardContext';

type Props = {
  readonly group: VisibleGroup;
  readonly isFirstOpenGroup: boolean;
  readonly onShowMore: () => void;
};

export const BoardGroup = ({ group, isFirstOpenGroup, onShowMore }: Props) => {
  const { openIds, removal } = useBoardContext();
  const isMerged = group.id === 'merged';
  return (
    <div
      role="group"
      aria-label={group.label}
      data-board-group={group.id}
      className="col-span-full grid grid-cols-subgrid gap-y-0.5"
    >
      <div className="col-span-full flex h-8 min-w-0 items-center gap-2 px-2">
        <h2 className="min-w-0 truncate text-heading text-foreground">{group.label}</h2>
        <span className="flex shrink-0 items-baseline text-ui tabular-nums text-faint-foreground">
          {group.rowIds.length + group.hiddenCount}
        </span>
        <span className="min-w-0 flex-1" />
        {isMerged ? <BoardRemoveButton mountIds={null} variant="secondary" /> : null}
        {isFirstOpenGroup ? <BoardMergeInOrder /> : null}
      </div>
      {isMerged && removal.failures.length > 0 ? (
        <ul className="col-span-full flex min-w-0 flex-col gap-0.5 px-2">
          {removal.failures.map((failure) => (
            <li
              key={failure.mountId}
              role="alert"
              className="flex min-w-0 items-center gap-2 text-meta text-danger"
            >
              <CircleAlert size={ICON_SIZE.control} aria-hidden className="shrink-0" />
              <span className="min-w-0 truncate">
                {failure.branch}: {failure.reason}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {group.rowIds.map((rowId) => (
        <BoardRow key={rowId} rowId={rowId} isOpen={openIds.has(rowId)} />
      ))}
      {group.hiddenCount > 0 ? (
        <div className="col-span-full flex px-2">
          <Button size="sm" variant="quiet" onClick={onShowMore}>
            Show {group.hiddenCount} more
          </Button>
        </div>
      ) : null}
      {group.isFoldable && group.hiddenCount === 0 ? (
        <div className="col-span-full flex px-2">
          <Button size="sm" variant="quiet" onClick={onShowMore}>
            Show fewer
          </Button>
        </div>
      ) : null}
    </div>
  );
};
