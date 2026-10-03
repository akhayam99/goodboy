import type { InboxRecord } from './types';

type Params = {
  readonly record: InboxRecord | null;
};

export const recordCanReply = ({ record }: Params): boolean =>
  record !== null && record.payload.provider !== 'sentry';
