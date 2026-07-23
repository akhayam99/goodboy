import type { ReviewablePr } from '@goodboy/types';

export type ReviewPrsState = {
  readonly items: ReadonlyArray<ReviewablePr>;
  readonly loading: boolean;
  readonly error: string | null;
  readonly fetchedAt: string | null;
};

export type { GetFn, SetFn } from '../../slice-types';
