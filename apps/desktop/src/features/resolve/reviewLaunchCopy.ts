import { ordinalOf } from '../../shared/utils/ordinalOf';

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
  readonly place: number;
  readonly total: number;
};

export const fixingCountText = ({ place, total }: FixingCount): string =>
  `Fixing ${place} of ${threadCountText({ count: total })}`;

export const fixingPlaceText = ({ place, total }: FixingCount): string => `${place} of ${total}`;

type PlaceParams = {
  readonly place: number;
};

export const queuedPlaceText = ({ place }: PlaceParams): string =>
  `${ordinalOf({ n: place })} in this fix`;
