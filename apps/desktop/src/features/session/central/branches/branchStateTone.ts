import type { Tone } from '@goodboy/ui';

export type BranchState =
  | 'unread'
  | 'rebasing'
  | 'gone'
  | 'nothing-committed'
  | 'not-pushed'
  | 'no-request'
  | 'draft'
  | 'open'
  | 'checks-running'
  | 'checks-failing'
  | 'in-review'
  | 'changes-requested'
  | 'conflicts'
  | 'approved'
  | 'ready'
  | 'queued'
  | 'merged'
  | 'closed';

export const BRANCH_STATE_TONE = {
  unread: 'neutral',
  rebasing: 'info',
  gone: 'warning',
  'nothing-committed': 'neutral',
  'not-pushed': 'neutral',
  'no-request': 'neutral',
  draft: 'neutral',
  open: 'info',
  'checks-running': 'info',
  'checks-failing': 'danger',
  'in-review': 'info',
  'changes-requested': 'warning',
  conflicts: 'warning',
  approved: 'success',
  ready: 'success',
  queued: 'primary',
  merged: 'merged',
  closed: 'neutral',
} as const satisfies Readonly<Record<BranchState, Tone>>;
