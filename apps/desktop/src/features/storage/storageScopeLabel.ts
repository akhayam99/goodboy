type Params = {
  readonly workspaceName: string | null;
};

export const storageScopeLabel = ({ workspaceName }: Params): string =>
  workspaceName === null ? 'in all workspaces' : `in ${workspaceName}`;
