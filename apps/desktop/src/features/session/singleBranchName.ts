type Params = {
  readonly mounts: ReadonlyArray<{ readonly branch?: string | null }>;
  readonly sessionBranch: string | null;
};

export const singleBranchName = ({ mounts, sessionBranch }: Params): string | null => {
  if (mounts.length > 1) {
    return null;
  }
  const name = (mounts.length === 1 ? mounts[0]?.branch : sessionBranch)?.trim() ?? '';
  return name === '' ? null : name;
};
