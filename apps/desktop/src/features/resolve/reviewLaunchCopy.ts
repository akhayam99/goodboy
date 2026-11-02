export const REVIEW_LAUNCH_LABEL = {
  fix: 'Fix',
  selectRow: 'Select the comment by',
  selectionBar: 'Selected comments',
  newCommit: 'New commit',
  fixup: 'Fixup of the original',
} as const;

type CountParams = {
  readonly count: number;
};

export const fixLabel = ({ count }: CountParams): string => `Fix ${count}`;

export const threadCountText = ({ count }: CountParams): string =>
  count === 1 ? '1 thread' : `${count} threads`;

export const commitCountText = ({ count }: CountParams): string =>
  count === 1 ? '1 commit' : `${count} commits`;
