type Params = {
  readonly asker: string;
  readonly toolName: string;
};

export const permissionAskTitleOf = ({ asker, toolName }: Params): string =>
  `${asker} wants to run ${toolName === 'Bash' ? 'a command' : toolName}`;
