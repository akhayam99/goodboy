import { isUserPayload } from '@goodboy/core/auto';
import type { AutoOutboxRow } from '@goodboy/db';
import { scopedReadGrantsOf } from '../../slices/permissions/scopedReadGrantsOf';

type Params = {
  readonly rows: ReadonlyArray<Pick<AutoOutboxRow, 'payload'>>;
};

export const userOnceAllowsOf = ({ rows }: Params): ReadonlyArray<string> => {
  const grants = rows.flatMap(({ payload }) =>
    isUserPayload(payload) ? (payload.permissionOnceAllows ?? []) : [],
  );
  return [...new Set(scopedReadGrantsOf({ grants }))];
};
