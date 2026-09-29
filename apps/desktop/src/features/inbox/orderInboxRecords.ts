import { compareIsoDesc } from '../../shared/utils/compareIsoDesc';
import type { InboxRecord } from './types';

type Params = {
  readonly records: ReadonlyArray<InboxRecord>;
};

export const orderInboxRecords = ({ records }: Params): ReadonlyArray<InboxRecord> =>
  [...records].sort(
    (left, right) =>
      compareIsoDesc({ left: left.updatedAt, right: right.updatedAt }) ||
      left.key.localeCompare(right.key),
  );
