import { countNoun } from '../../../../shared/utils/countNoun';
type Params = {
  readonly repoCount: number;
  readonly folderCount: number;
};

export const projectsCountLine = ({ repoCount, folderCount }: Params): string => {
  const projects = `${countNoun({ count: repoCount, one: 'project' })}`;
  if (folderCount === 0) {
    return projects;
  }
  return `${projects}, ${folderCount} plain ${folderCount === 1 ? 'folder' : 'folders'}`;
};
