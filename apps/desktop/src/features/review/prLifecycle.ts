const PR_LIFECYCLE_ACTIONS = ['ready', 'undraft', 'merge', 'close', 'reopen'] as const;

export type PrLifecycleAction = (typeof PR_LIFECYCLE_ACTIONS)[number];

export type PrNouns = {
  readonly long: string;
  readonly numberPrefix: string;
};

const GITHUB_NOUNS: PrNouns = { long: 'pull request', numberPrefix: '#' };

export const prLifecycleFailureTitle = ({
  action,
  prNumber,
  nouns = GITHUB_NOUNS,
}: {
  readonly action: PrLifecycleAction;
  readonly prNumber: number | null;
  readonly nouns?: PrNouns;
}): string => {
  const target = prNumber === null ? `the ${nouns.long}` : `${nouns.numberPrefix}${prNumber}`;
  switch (action) {
    case 'ready':
      return `Couldn't mark ${target} ready`;
    case 'undraft':
      return `Couldn't convert ${target} to a draft`;
    case 'merge':
      return `Couldn't merge ${target}`;
    case 'close':
      return `Couldn't close ${target}`;
    case 'reopen':
      return `Couldn't reopen ${target}`;
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
};

const PR_LIFECYCLE_GERUND: Record<PrLifecycleAction, string> = {
  ready: 'marking ready',
  undraft: 'converting to draft',
  merge: 'merging',
  close: 'closing',
  reopen: 'reopening',
};

export const describePrWriteInFlight = ({
  action,
  prNumber,
  nouns = GITHUB_NOUNS,
}: {
  readonly action: PrLifecycleAction;
  readonly prNumber: number;
  readonly nouns?: PrNouns;
}): string => `Goodboy is already ${PR_LIFECYCLE_GERUND[action]} ${nouns.numberPrefix}${prNumber}`;
