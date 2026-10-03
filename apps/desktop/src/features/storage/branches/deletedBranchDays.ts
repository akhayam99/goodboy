import { DELETED_BRANCH_KEEP_DAYS, type IsoDateTime } from '@goodboy/types';

const DAY_MS = 24 * 60 * 60 * 1000;

type Params = {
  readonly deletedAt: IsoDateTime;
  readonly now: number;
};

export type DeletedBranchDays = {
  readonly ago: number;
  readonly left: number;
};

export const deletedBranchDays = ({ deletedAt, now }: Params): DeletedBranchDays => {
  const ago = Math.max(0, Math.floor((now - Date.parse(deletedAt)) / DAY_MS));
  return { ago, left: Math.max(0, DELETED_BRANCH_KEEP_DAYS - ago) };
};
