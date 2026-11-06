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
  count === 1 ? '1 comment' : `${count} comments`;

export type FixingCount = {
  readonly working: number;
  readonly total: number;
};

export const fixingCountText = ({ working, total }: FixingCount): string =>
  working >= total
    ? `Fixing ${threadCountText({ count: total })}`
    : `Fixing ${working} of ${threadCountText({ count: total })}`;
