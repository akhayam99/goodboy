export type PullRequestProvider = 'github' | 'gitlab' | 'bitbucket';

type PullRequestAvailability = Readonly<Record<PullRequestProvider, boolean>>;

export const PROVIDER_PRIORITY: ReadonlyArray<PullRequestProvider> = [
  'github',
  'gitlab',
  'bitbucket',
];
