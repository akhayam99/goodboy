import type { InboxRecord } from './types';

type Params = {
  readonly record: Pick<InboxRecord, 'provider' | 'identifier'>;
};

const KEY_SEPARATOR = '-';

export const taskKeyOf = ({ record }: Params): string => {
  if (record.provider === 'slack') {
    return '';
  }
  if (record.provider !== 'sentry') {
    return record.identifier;
  }
  const cut = record.identifier.lastIndexOf(KEY_SEPARATOR);
  return cut === -1 ? record.identifier : record.identifier.slice(cut + 1);
};
