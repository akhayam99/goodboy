const HEADS_PREFIX = 'refs/heads/';
const REMOTES_PREFIX = 'refs/remotes/';

type Params = {
  readonly ref: string;
  readonly remotes: ReadonlyArray<string>;
};

const withoutRemote = ({ ref, remotes }: Params): string => {
  const matching = remotes
    .filter((remote) => remote !== '' && ref.startsWith(`${remote}/`))
    .sort((left, right) => right.length - left.length)[0];
  if (matching === undefined) {
    return ref;
  }
  const branch = ref.slice(matching.length + 1);
  return branch === '' ? ref : branch;
};

export const remoteBranchName = ({ ref, remotes }: Params): string => {
  const trimmed = ref.trim();
  if (trimmed.startsWith(HEADS_PREFIX)) {
    return trimmed.slice(HEADS_PREFIX.length);
  }
  if (trimmed.startsWith(REMOTES_PREFIX)) {
    return withoutRemote({ ref: trimmed.slice(REMOTES_PREFIX.length), remotes });
  }
  return withoutRemote({ ref: trimmed, remotes });
};
