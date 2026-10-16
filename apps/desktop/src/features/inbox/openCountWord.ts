import type { InboxRecord } from './types';

type Params = {
  readonly records: ReadonlyArray<Pick<InboxRecord, 'state'>>;
};

export const openCountWord = ({ records }: Params): string =>
  `${records.filter((record) => record.state !== 'done').length.toLocaleString('en-US')} open`;
