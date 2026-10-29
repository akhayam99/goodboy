const ROOT_FOLDER = 'Root files';

type Params = {
  readonly path: string;
};

export const topFolderOf = ({ path }: Params): string => {
  const slash = path.indexOf('/');
  return slash === -1 ? ROOT_FOLDER : path.slice(0, slash);
};
