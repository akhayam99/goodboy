export const REVIEW_LAUNCH_LABEL = {
  fix: 'Fix',
  selectRow: 'Select the comment by',
  selectionBar: 'Selected comments',
  newCommit: 'New commit',
  fixup: 'Fixup of the original',
} as const;

export type LaunchNoun = 'comment' | 'note';

type CountParams = {
  readonly count: number;
};

export const fixLabel = ({ count }: CountParams): string => `Fix ${count}`;
