export type PullRequestProvider = 'github' | 'gitlab' | 'bitbucket';

export type PullRequestAvailability = Readonly<Record<PullRequestProvider, boolean>>;

export const PROVIDER_PRIORITY: ReadonlyArray<PullRequestProvider> = [
  'github',
  'gitlab',
  'bitbucket',
];
