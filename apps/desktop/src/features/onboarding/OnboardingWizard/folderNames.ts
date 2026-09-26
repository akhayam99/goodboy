const folderParts = ({ rootPath }: { readonly rootPath: string }): ReadonlyArray<string> =>
  rootPath.split('/').filter((part) => part.length > 0);

export const capitalize = (value: string): string =>
  value.length === 0 ? value : `${value[0]?.toUpperCase() ?? ''}${value.slice(1)}`;

export const workspaceNameFor = ({ rootPath }: { readonly rootPath: string }): string => {
  const parts = folderParts({ rootPath });
  return capitalize(parts.at(-2) ?? parts.at(-1) ?? 'Projects');
};

export const folderName = ({ rootPath }: { readonly rootPath: string }): string =>
  folderParts({ rootPath }).at(-1) ?? 'project';
