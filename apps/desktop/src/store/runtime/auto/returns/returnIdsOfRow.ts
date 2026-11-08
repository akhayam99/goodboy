import { isResultsPayload } from '@goodboy/core/auto';
import type { AutoOutboxRow } from '@goodboy/db';
import { isRecord } from '@goodboy/types/helpers';

type Params = {
  readonly row: Pick<AutoOutboxRow, 'payload'>;
};

export const returnIdsOfRow = ({ row }: Params): ReadonlyArray<string> => {
  const payload = row.payload;
  if (!isResultsPayload(payload)) {
    return [];
  }
  if (typeof payload.returnOf === 'string') {
    return [payload.returnOf];
  }
  return payload.results.flatMap((entry) =>
    isRecord(entry) && entry['outcome'] === 'blocked' && typeof entry['delegationId'] === 'string'
      ? [entry['delegationId']]
      : [],
  );
};
