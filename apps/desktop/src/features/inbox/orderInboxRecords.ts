import type { InboxRecord } from './types';

type Params = {
  readonly records: ReadonlyArray<InboxRecord>;
};

const timeOf = (iso: string): number => {
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const orderInboxRecords = ({ records }: Params): ReadonlyArray<InboxRecord> =>
  [...records].sort((left, right) => timeOf(right.updatedAt) - timeOf(left.updatedAt));
