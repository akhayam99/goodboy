export type PrLifecycleAction = 'ready' | 'undraft' | 'merge' | 'close' | 'reopen';

export type PrLifecycleBusy = PrLifecycleAction | null;

export const PR_LIFECYCLE_FAILURE_LABEL: Record<PrLifecycleAction, string> = {
  ready: 'Mark ready failed',
  undraft: 'Convert to draft failed',
  merge: 'Merge failed',
  close: 'Close failed',
  reopen: 'Reopen failed',
};
