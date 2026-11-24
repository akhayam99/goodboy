const MAIN = 'main';
const MAIN_REFSPEC = '+refs/heads/main:refs/remotes/origin/main';
const MAIN_REF = 'refs/remotes/origin/main';
const FETCH_DEPTH = 200;
const DEEPEN_BY = 1000;
const MAX_DEEPENS = 5;

const shortOf = ({ sha }) => sha.slice(0, 7);

const isCommit = ({ git, sha }) =>
  git({ args: ['cat-file', '-e', `${sha}^{commit}`] }).status === 0;

const diffSince = ({ git, base, paths, label }) => {
  const { status } = git({ args: ['diff', '--quiet', base, 'HEAD', '--', ...paths] });
  if (status === 0) {
    return { shouldBuild: false, reason: `nothing it reads changed since ${label}` };
  }
  if (status === 1) {
    return { shouldBuild: true, reason: `changed since ${label}` };
  }
  return { shouldBuild: true, reason: `git diff against ${label} failed` };
};

const remoteOf = ({ env, git }) => {
  if (git({ args: ['remote', 'get-url', 'origin'] }).status === 0) {
    return 'origin';
  }
  const owner = env.VERCEL_GIT_REPO_OWNER ?? '';
  const slug = env.VERCEL_GIT_REPO_SLUG ?? '';
  if (env.VERCEL_GIT_PROVIDER !== 'github' || owner === '' || slug === '') {
    return null;
  }
  return `https://github.com/${owner}/${slug}.git`;
};

const mergeBaseOf = ({ git }) => {
  const { status, stdout } = git({ args: ['merge-base', 'HEAD', MAIN_REF] });
  if (status !== 0 || stdout === '') {
    return null;
  }
  return stdout;
};

const findMergeBase = ({ env, git, branch }) => {
  const remote = remoteOf({ env, git });
  if (remote == null) {
    return mergeBaseOf({ git });
  }
  const isShallow = git({ args: ['rev-parse', '--is-shallow-repository'] }).stdout === 'true';
  const depth = isShallow ? [`--depth=${FETCH_DEPTH}`] : [];
  git({ args: ['fetch', '--no-tags', '--quiet', ...depth, remote, MAIN_REFSPEC] });
  if (!isShallow) {
    return mergeBaseOf({ git });
  }
  const branchRefspec = `+refs/heads/${branch}:refs/remotes/origin/${branch}`;
  for (let round = 0; round < MAX_DEEPENS; round += 1) {
    const base = mergeBaseOf({ git });
    if (base != null) {
      return base;
    }
    if (git({ args: ['rev-parse', '--is-shallow-repository'] }).stdout !== 'true') {
      return null;
    }
    const { status } = git({
      args: [
        'fetch',
        '--no-tags',
        '--quiet',
        `--deepen=${DEEPEN_BY}`,
        remote,
        MAIN_REFSPEC,
        branchRefspec,
      ],
    });
    if (status !== 0) {
      return null;
    }
  }
  return mergeBaseOf({ git });
};

export const changedSinceBaseOf = ({ env, paths, git }) => {
  const previousSha = env.VERCEL_GIT_PREVIOUS_SHA ?? '';
  if (previousSha !== '' && isCommit({ git, sha: previousSha })) {
    return diffSince({
      git,
      base: previousSha,
      paths,
      label: `last deploy ${shortOf({ sha: previousSha })}`,
    });
  }
  const branch = env.VERCEL_GIT_COMMIT_REF ?? '';
  if (branch === '' || branch === MAIN) {
    return { shouldBuild: true, reason: `no earlier deploy of ${MAIN} in this clone` };
  }
  const base = findMergeBase({ env, git, branch });
  if (base == null) {
    return { shouldBuild: true, reason: `no merge base with origin/${MAIN}` };
  }
  return diffSince({
    git,
    base,
    paths,
    label: `merge base ${shortOf({ sha: base })} with origin/${MAIN}`,
  });
};
