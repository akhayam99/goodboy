import type { InboxRecord, InboxState } from './types';

const STATE_PRIORITY = {
  alert: 0,
  active: 1,
  open: 2,
  done: 3,
} satisfies Record<InboxState, number>;

type Params = {
  readonly records: ReadonlyArray<InboxRecord>;
};

export const orderInboxRecords = ({ records }: Params): ReadonlyArray<InboxRecord> =>
  [...records].sort((left, right) => {
    const stateDifference = STATE_PRIORITY[left.state] - STATE_PRIORITY[right.state];
    if (stateDifference !== 0) {
      return stateDifference;
    }
    return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
  });
