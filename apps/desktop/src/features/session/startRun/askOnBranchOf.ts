type Params = {
  readonly ask: string;
  readonly branch: string | null;
};

export const askOnBranchOf = ({ ask, branch }: Params): string =>
  branch === null ? ask : `${ask}\n\nWork on the branch ${branch}.`;
