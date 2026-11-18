import type { ProjectSection } from '../../central/board/projectSectionsOf';
import { BoardProjectHead } from './BoardProjectHead';
import { BoardTile } from './BoardTile';

type Props = {
  readonly section: ProjectSection;
};

export const BoardProjectSection = ({ section }: Props) => {
  const tiles = section.rowIds.map((rowId) => <BoardTile key={rowId} rowId={rowId} />);
  if (section.projectName === null) {
    return <>{tiles}</>;
  }
  return (
    <div
      role="group"
      aria-label={section.projectName}
      data-board-project={section.projectName}
      className="flex min-w-0 flex-col gap-1"
    >
      <BoardProjectHead projectName={section.projectName} count={section.rowIds.length} />
      {tiles}
    </div>
  );
};
