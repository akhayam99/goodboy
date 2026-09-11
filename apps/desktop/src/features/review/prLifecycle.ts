export type PrLifecycleAction = 'ready' | 'undraft' | 'merge' | 'close' | 'reopen';

export type PrLifecycleBusy = PrLifecycleAction | null;

export const PR_LIFECYCLE_FAILURE_LABEL: Record<PrLifecycleAction, string> = {
  ready: 'Mark ready failed',
  undraft: 'Convert to draft failed',
  merge: 'Merge failed',
  close: 'Close failed',
  reopen: 'Reopen failed',
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
