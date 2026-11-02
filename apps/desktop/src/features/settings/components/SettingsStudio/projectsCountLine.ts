type Params = {
  readonly repoCount: number;
  readonly folderCount: number;
};

export const projectsCountLine = ({ repoCount, folderCount }: Params): string => {
  const projects = `${repoCount} ${repoCount === 1 ? 'project' : 'projects'}`;
  if (folderCount === 0) {
    return projects;
  }
  return `${projects}, ${folderCount} plain ${folderCount === 1 ? 'folder' : 'folders'}`;
};
