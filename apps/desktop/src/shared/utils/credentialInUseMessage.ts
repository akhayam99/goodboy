type Params = {
  readonly usedBy: number;
};

export const credentialInUseMessage = ({ usedBy }: Params): string =>
  usedBy === 1
    ? 'One workspace still uses this key. Disconnect it there first.'
    : `${usedBy} workspaces still use this key. Disconnect them first.`;
