type Params = {
  readonly sha: string;
  readonly candidate: string;
};

export const branchShaMatches = ({ sha, candidate }: Params): boolean => {
  const a = sha.toLowerCase();
  const b = candidate.toLowerCase();
  return a.startsWith(b) || b.startsWith(a);
};
