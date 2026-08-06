import type { RemoteHostKind } from '../../../../../shared/lib/remoteHost';

export type PullRequestProvider = 'github' | 'gitlab' | 'bitbucket';

export type PullRequestAvailability = Readonly<Record<PullRequestProvider, boolean>>;

export const PROVIDER_PRIORITY: ReadonlyArray<PullRequestProvider> = [
  'github',
  'gitlab',
  'bitbucket',
];

type HintParams = {
  readonly remoteKind: RemoteHostKind | null;
};

const hintedProvider = ({ remoteKind }: HintParams): PullRequestProvider | null => {
  if (remoteKind === 'gitlab') {
    return 'gitlab';
  }
  if (remoteKind === 'github') {
    return 'github';
  }
  return null;
};

type CountParams = {
  readonly availability: PullRequestAvailability;
};

export const availableProviderCount = ({ availability }: CountParams): number =>
  PROVIDER_PRIORITY.filter((provider) => availability[provider]).length;

type Params = {
  readonly selected: PullRequestProvider | null;
  readonly availability: PullRequestAvailability;
  readonly remoteKind: RemoteHostKind | null;
};

export const resolvePullRequestProvider = ({
  selected,
  availability,
  remoteKind,
}: Params): PullRequestProvider => {
  if (selected != null && availability[selected]) {
    return selected;
  }
  const hinted = hintedProvider({ remoteKind });
  if (hinted != null && availability[hinted]) {
    return hinted;
  }
  const firstWithData = PROVIDER_PRIORITY.find((provider) => availability[provider]);
  if (firstWithData != null) {
    return firstWithData;
  }
  return hinted ?? 'github';
};
