const LEAD = "Couldn't open the pull request";

const BASE_MISSING = /Base ref must be a branch|Base sha can't be blank/i;
const HEAD_MISSING = /Head sha can't be blank|Head ref must be a branch/i;
const NO_COMMITS = /No commits between/i;

type Params = {
  readonly stderr: string;
  readonly base: string | undefined;
};

export const createPrFailureText = ({ stderr, base }: Params): string => {
  if (BASE_MISSING.test(stderr)) {
    const name = base === undefined ? 'the base branch' : `the base branch ${base}`;
    return `${LEAD}: ${name} isn't on GitHub. Pick a base that exists there and retry.`;
  }
  if (HEAD_MISSING.test(stderr)) {
    return `${LEAD}: the branch isn't on GitHub yet. Push it and retry.`;
  }
  if (NO_COMMITS.test(stderr)) {
    const name = base === undefined ? 'the base branch' : base;
    return `${LEAD}: the branch has no commits that ${name} lacks. Commit the work and retry.`;
  }
  return stderr.trim();
};
