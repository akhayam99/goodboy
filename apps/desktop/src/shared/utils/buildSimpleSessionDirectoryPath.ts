type Params = {
  readonly workspaceRoot: string;
  readonly folderName: string;
};

export const buildSimpleSessionDirectoryPath = ({ workspaceRoot, folderName }: Params): string => {
  const normalizedRoot = workspaceRoot === '/' ? workspaceRoot : workspaceRoot.replace(/\/+$/, '');
  return `${normalizedRoot}/sessions/${folderName}`;
};
