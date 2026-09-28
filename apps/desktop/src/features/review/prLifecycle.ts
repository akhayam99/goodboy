export type PrLifecycleAction = 'ready' | 'undraft' | 'merge' | 'close' | 'reopen';

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
