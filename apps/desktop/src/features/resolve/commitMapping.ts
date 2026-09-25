type Commit = { readonly sha: string };

export const isSameCommit = ({
  left,
  right,
}: {
  readonly left: string;
  readonly right: string;
}): boolean => left !== '' && right !== '' && (left.startsWith(right) || right.startsWith(left));

export const remapCommitShas = ({
  shas,
  before,
  after,
}: {
  readonly shas: ReadonlyArray<string>;
  readonly before: ReadonlyArray<Commit>;
  readonly after: ReadonlyArray<Commit>;
}): ReadonlyArray<string> => {
  if (before.length === 0 || before.length !== after.length) {
    return shas;
  }
  return shas.map((sha) => {
    const index = before.findIndex((commit) => isSameCommit({ left: commit.sha, right: sha }));
    return after[index]?.sha ?? sha;
  });
};
