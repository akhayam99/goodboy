type Params = {
  readonly projectRoot: string;
  readonly folderName: string;
};

export const buildSimpleSessionDirectoryPath = ({ projectRoot, folderName }: Params): string => {
  const normalizedRoot = projectRoot === '/' ? projectRoot : projectRoot.replace(/\/+$/, '');
  return `${normalizedRoot}/sessions/${folderName}`;
};
