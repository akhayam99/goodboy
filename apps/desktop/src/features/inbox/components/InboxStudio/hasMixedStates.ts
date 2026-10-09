import type { InboxRecord } from '../../types';

type Params = {
  readonly records: ReadonlyArray<Pick<InboxRecord, 'stateLabel'>>;
};

export const hasMixedStates = ({ records }: Params): boolean =>
  new Set(records.map((record) => record.stateLabel)).size > 1;
