import { execFileSync } from 'node:child_process';

export const git = (cwd: string, args: ReadonlyArray<string>): string =>
  execFileSync('git', [...args], {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
    },
  }).trim();

export const isAncestor = (cwd: string, ancestor: string, descendant: string): boolean => {
  if (ancestor === descendant) {
    return true;
  }
  try {
    git(cwd, ['merge-base', '--is-ancestor', ancestor, descendant]);
    return true;
  } catch {
    return false;
  }
};

export const revList = (cwd: string, range: string): ReadonlyArray<string> =>
  git(cwd, ['rev-list', range])
    .split('\n')
    .filter((line) => line !== '');

type QuarantineParams = {
  readonly worktreePath: string;
  readonly candidateId: string;
  readonly baseSha: string;
  readonly stack?: boolean;
};

export const quarantineCandidate = ({
  worktreePath,
  candidateId,
  baseSha,
  stack = false,
}: QuarantineParams): { readonly sha: string | null; readonly baseSha: string } => {
  const head = git(worktreePath, ['rev-parse', 'HEAD']);
  if (!isAncestor(worktreePath, baseSha, head)) {
    throw new Error('the branch head is not built on the recorded candidate base');
  }
  if (git(worktreePath, ['status', '--porcelain=v1']) !== '') {
    git(worktreePath, ['add', '--update']);
    if (git(worktreePath, ['diff', '--cached', '--name-only']) !== '') {
      git(worktreePath, ['commit', '--no-verify', '--quiet', '-m', `candidate ${candidateId}`]);
    }
  }
  const tip = git(worktreePath, ['rev-parse', 'HEAD']);
  if (tip === baseSha) {
    return { sha: null, baseSha };
  }
  git(worktreePath, ['update-ref', `refs/goodboy/candidates/${candidateId}`, tip]);
  const restAt = stack ? tip : baseSha;
  git(worktreePath, ['update-ref', 'HEAD', restAt, tip]);
  git(worktreePath, ['reset', '--hard', '--quiet', restAt]);
  return { sha: tip, baseSha };
};

type Pick = { readonly candidateId: string; readonly commitSha: string };

type SplitParams = {
  readonly worktreePath: string;
  readonly baseSha: string;
  readonly picks: ReadonlyArray<Pick>;
  readonly stack?: boolean;
};

type Split = { readonly candidateId: string; readonly sha: string | null };

const splitStacked = ({ worktreePath, baseSha, picks }: SplitParams): ReadonlyArray<Split> => {
  const none = picks.map(({ candidateId }): Split => ({ candidateId, sha: null }));
  const head = git(worktreePath, ['rev-parse', 'HEAD']);
  const range = `${baseSha}..${head}`;
  if (git(worktreePath, ['rev-list', '--merges', range]) !== '') {
    return none;
  }
  const order = [...revList(worktreePath, range)].reverse();
  const placed = picks.flatMap(({ candidateId, commitSha }) => {
    const resolved = git(worktreePath, ['rev-parse', commitSha]);
    const index = order.indexOf(resolved);
    return index < 0 ? [] : [{ index, commit: resolved, candidateId }];
  });
  placed.sort((left, right) => left.index - right.index);
  const isContiguous = placed.every((item, slot) => item.index === slot);
  if (placed.length !== picks.length || placed.length !== order.length || !isContiguous) {
    return none;
  }
  for (const { commit, candidateId } of placed) {
    git(worktreePath, ['update-ref', `refs/goodboy/candidates/${candidateId}`, commit]);
  }
  return placed.map(({ candidateId, commit }) => ({ candidateId, sha: commit }));
};

export const splitCandidates = ({
  worktreePath,
  baseSha,
  picks,
  stack = false,
}: SplitParams): ReadonlyArray<Split> => {
  if (stack) {
    return splitStacked({ worktreePath, baseSha, picks });
  }
  return picks.map(({ candidateId, commitSha }) => {
    try {
      git(worktreePath, ['cherry-pick', '--allow-empty', commitSha]);
      const tip = git(worktreePath, ['rev-parse', 'HEAD']);
      git(worktreePath, ['update-ref', `refs/goodboy/candidates/${candidateId}`, tip]);
      git(worktreePath, ['reset', '--hard', '--quiet', baseSha]);
      return { candidateId, sha: tip };
    } catch {
      try {
        git(worktreePath, ['cherry-pick', '--abort']);
      } catch {
        git(worktreePath, ['reset', '--hard', '--quiet', baseSha]);
      }
      git(worktreePath, ['reset', '--hard', '--quiet', baseSha]);
      return { candidateId, sha: null };
    }
  });
};
