const FIXUP_PREFIX = 'fixup! ';

type Commit = { readonly sha: string; readonly subject: string };

type Params = {
  readonly sha: string;
  readonly range: ReadonlyArray<Commit>;
  readonly branch: ReadonlyArray<Commit>;
};

const sameCommit = ({ left, right }: { readonly left: string; readonly right: string }) =>
  left !== '' && right !== '' && (left.startsWith(right) || right.startsWith(left));

export const fixupTargetOf = ({ sha, range, branch }: Params): string | null => {
  const index = range.findIndex((commit) => sameCommit({ left: commit.sha, right: sha }));
  const commit = range[index];
  if (commit === undefined || !commit.subject.startsWith(FIXUP_PREFIX)) {
    return null;
  }
  const subject = commit.subject.slice(FIXUP_PREFIX.length);
  const earlier = [...branch, ...range.slice(0, index)].reverse();
  return earlier.find((candidate) => candidate.subject === subject)?.sha ?? null;
};
