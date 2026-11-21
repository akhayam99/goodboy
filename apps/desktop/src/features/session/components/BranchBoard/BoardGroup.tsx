import { Button } from '@goodboy/ui';
import type { VisibleGroup } from '../../central/board/visibleGroupsOf';
import { projectSectionsOf } from '../../central/board/projectSectionsOf';
import { BoardMergeInOrder } from './BoardMergeInOrder';
import { BoardProjectSection } from './BoardProjectSection';
import { BoardRemoveButton } from './BoardRemoveButton';
import { BoardTile } from './BoardTile';
import { useBoardContext } from './useBoardContext';

type Props = {
  readonly group: VisibleGroup;
  readonly isFirstOpenGroup: boolean;
  readonly onShowMore: () => void;
};

export const BoardGroup = ({ group, isFirstOpenGroup, onShowMore }: Props) => {
  const { rowById, isMultiProject } = useBoardContext();
  const isMerged = group.id === 'merged';
  return (
    <div
      role="group"
      aria-label={group.label}
      data-board-group={group.id}
      className="flex min-w-0 flex-col gap-1"
    >
      <div className="flex h-8 min-w-0 items-center gap-2 px-2">
        <h2 className="min-w-0 truncate text-heading text-foreground">{group.label}</h2>
        <span className="flex shrink-0 items-baseline text-ui tabular-nums text-faint-foreground">
          {group.rowIds.length + group.hiddenCount}
        </span>
        <span className="min-w-0 flex-1" />
        {isMerged ? <BoardRemoveButton mountIds={null} variant="secondary" /> : null}
        {isFirstOpenGroup ? <BoardMergeInOrder /> : null}
      </div>
      {isMultiProject
        ? projectSectionsOf({ rowIds: group.rowIds, rowById }).map((section) => (
            <BoardProjectSection key={section.projectId ?? ''} section={section} />
          ))
        : group.rowIds.map((rowId) => <BoardTile key={rowId} rowId={rowId} />)}
      {group.hiddenCount > 0 ? (
        <div className="flex px-2">
          <Button size="sm" variant="quiet" onClick={onShowMore}>
            Show {group.hiddenCount} more
          </Button>
        </div>
      ) : null}
      {group.isFoldable && group.hiddenCount === 0 ? (
        <div className="flex px-2">
          <Button size="sm" variant="quiet" onClick={onShowMore}>
            Show fewer
          </Button>
        </div>
      ) : null}
    </div>
  );
};
