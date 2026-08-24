type Params = {
  readonly branch?: string | null | undefined;
};

export const isBranchlessSession = ({ branch }: Params): boolean =>
  branch != null && branch.trim() === '';
