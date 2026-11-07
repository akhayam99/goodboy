import type { SessionId } from '@goodboy/types';
import { STORAGE_PREFIXES } from '../../../shared/lib/storage-keys';
import { storageKeyOf } from '../../../shared/lib/storageKeyOf';
import { storedText } from '../../../shared/lib/storedText';
import type { GroupBy } from './state';

type SessionParams = Readonly<{
  sessionId: SessionId;
}>;

type WriteParams = SessionParams &
  Readonly<{
    groupBy: GroupBy;
  }>;

type RawParams = Readonly<{
  raw: string;
}>;

const groupByKeyOf = ({ sessionId }: SessionParams): string =>
  storageKeyOf({ prefix: STORAGE_PREFIXES.sessionGrouping, id: sessionId });

const groupByOf = ({ raw }: RawParams): GroupBy | null =>
  raw === 'branch' || raw === 'state' ? raw : null;

export const storedGroupBy = {
  read: ({ sessionId }: SessionParams): GroupBy | null =>
    groupByOf({ raw: storedText.read({ key: groupByKeyOf({ sessionId }) }) }),
  write: ({ sessionId, groupBy }: WriteParams): void =>
    storedText.write({ key: groupByKeyOf({ sessionId }), text: groupBy }),
  forget: ({ sessionId }: SessionParams): void =>
    storedText.write({ key: groupByKeyOf({ sessionId }), text: '' }),
};
