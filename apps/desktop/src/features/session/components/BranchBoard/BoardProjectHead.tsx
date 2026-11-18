import { ICON_SIZE } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly projectName: string;
  readonly count: number | null;
};

export const BoardProjectHead = ({ projectName, count }: Props) => {
  const ProjectIcon = CONCEPT_ICONS.projectRepo;
  return (
    <div data-board-project-head="" className="flex h-7 min-w-0 items-center gap-2 px-2">
      <ProjectIcon size={ICON_SIZE.row} aria-hidden className="shrink-0 text-faint-foreground" />
      <span className="min-w-0 truncate text-meta text-muted-foreground">{projectName}</span>
      {count === null ? null : (
        <span className="shrink-0 text-meta tabular-nums text-faint-foreground">{count}</span>
      )}
    </div>
  );
};
