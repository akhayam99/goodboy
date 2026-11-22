import { Button } from '@goodboy/ui';
import type { ProjectBlock as ProjectBlockModel } from '../../central/board/projectBlocksOf';
import { BoardMergeInOrder } from './BoardMergeInOrder';
import { BoardProjectHead } from './BoardProjectHead';
import { BoardRemoveButton } from './BoardRemoveButton';
import { BoardTile } from './BoardTile';

type Props = {
  readonly block: ProjectBlockModel;
  readonly hasMergeDoor: boolean;
  readonly hasRemoveDoor: boolean;
  readonly onToggleFold: () => void;
};

export const ProjectBlock = ({ block, hasMergeDoor, hasRemoveDoor, onToggleFold }: Props) => {
  const name = block.projectName ?? 'Not on a branch';
  return (
    <div
      role="group"
      aria-label={name}
      data-board-project={name}
      className="flex min-w-0 flex-col gap-1 rounded-lg bg-subtle p-2"
    >
      <BoardProjectHead
        projectId={block.projectId}
        projectName={name}
        door={
          <>
            {hasRemoveDoor ? <BoardRemoveButton mountIds={null} variant="quiet" /> : null}
            {hasMergeDoor ? <BoardMergeInOrder /> : null}
          </>
        }
      />
      {block.rowIds.map((rowId) => (
        <BoardTile key={rowId} rowId={rowId} />
      ))}
      {block.isFoldable ? (
        <div className="flex px-2">
          <Button size="sm" variant="quiet" onClick={onToggleFold}>
            {block.hiddenCount > 0 ? `Show ${block.hiddenCount} more` : 'Show fewer'}
          </Button>
        </div>
      ) : null}
    </div>
  );
};
