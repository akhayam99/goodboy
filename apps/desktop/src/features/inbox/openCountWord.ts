import type { InboxRecord } from './types';

type Params = {
  readonly records: ReadonlyArray<Pick<InboxRecord, 'state' | 'key'>>;
  readonly newKeys?: ReadonlySet<string>;
};

export const openCountWord = ({ records, newKeys }: Params): string => {
  const open = `${records.filter((record) => record.state !== 'done').length.toLocaleString('en-US')} open`;
  const arrived = records.filter((record) => newKeys?.has(record.key) === true).length;
  return arrived === 0 ? open : `${open}, ${arrived.toLocaleString('en-US')} new`;
};
