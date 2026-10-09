export const REVIEW_LAUNCH_LABEL = {
  fix: 'Fix',
  selectRow: 'Select the comment by',
  clearSelection: 'Clear',
  selectionBar: 'Selected comments',
  panel: 'Fix launch',
  includeRow: 'Include the comment by',
  newCommit: 'New commit',
  fixup: 'Fixup of the original',
  hintPlaceholder: 'Anything the fix run should know? Optional',
  hintLabel: 'Note for the fix run',
  remembered: 'Your pick, kept for this session',
  roleDefault: 'Resolver default',
  cancel: 'Cancel',
  noneIncluded: 'No comments included.',
} as const;

export type LaunchNoun = 'comment' | 'note';

type CountParams = {
  readonly count: number;
};

export const fixLabel = ({ count }: CountParams): string => `Fix ${count}`;

export const launchStartLabel = ({ count }: CountParams): string =>
  count === 0 ? 'Start fixing' : `Start fixing ${count}`;

export const LAUNCH_ORDER_LINE =
  'One agent works through them in order, in its own copy of the branch.';
