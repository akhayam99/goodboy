export type PrLifecycleAction = 'ready' | 'undraft' | 'merge' | 'close' | 'reopen';

export type PrLifecycleBusy = PrLifecycleAction | null;

export const prLifecycleFailureTitle = ({
  action,
  prNumber,
}: {
  readonly action: PrLifecycleAction;
  readonly prNumber: number | null;
}): string => {
  const target = prNumber === null ? 'the pull request' : `#${prNumber}`;
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
      const _exhaustive: never = action;
      return `Couldn't update ${target}`;
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
}: {
  readonly action: PrLifecycleAction;
  readonly prNumber: number;
}): string => `Goodboy is already ${PR_LIFECYCLE_GERUND[action]} #${prNumber}`;
