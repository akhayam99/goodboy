import { isResultsPayload } from '@goodboy/core/auto';
import type { AutoOutboxRow } from '@goodboy/db';

type Params = {
  readonly row: Pick<AutoOutboxRow, 'payload'>;
};

export const returnOfRow = ({ row }: Params): string | null => {
  const payload = row.payload;
  if (!isResultsPayload(payload) || typeof payload.returnOf !== 'string') {
    return null;
  }
  return payload.returnOf;
};
