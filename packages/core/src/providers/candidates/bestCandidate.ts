import type { ProviderId } from '@goodboy/types';
import { LIMITS_WARNING_FRACTION } from '../limits/constants';
import type { Candidate, CandidateList, CandidateRoom } from './types';

const HALF_USED_PERCENT = 50;

const NEAR_LIMIT_PERCENT = LIMITS_WARNING_FRACTION * 100;

const FULL_PERCENT = 100;

const UNKNOWN_ROOM_BAND = 1;

type BandParams = {
  readonly room: CandidateRoom | null;
};

const roomBand = ({ room }: BandParams): number => {
  if (room === null) {
    return UNKNOWN_ROOM_BAND;
  }
  if (room.usedPercent >= FULL_PERCENT) {
    return 3;
  }
  if (room.usedPercent >= NEAR_LIMIT_PERCENT) {
    return 2;
  }
  return room.usedPercent >= HALF_USED_PERCENT ? 1 : 0;
};

type KeyParams = {
  readonly row: Candidate;
  readonly list: CandidateList;
  readonly batch: ReadonlyArray<ProviderId>;
};

const sortKey = ({ row, list, batch }: KeyParams): ReadonlyArray<number> => {
  const band = roomBand({ room: row.room });
  const lighter = row.isLighter ? 1 : 0;
  if (list.rule === 'order') {
    return [band >= 2 ? 1 : 0, row.order, lighter];
  }
  const batchLoad = batch.filter((provider) => provider === row.provider).length;
  return [band, row.load + batchLoad, row.order, lighter];
};

type CompareParams = {
  readonly left: ReadonlyArray<number>;
  readonly right: ReadonlyArray<number>;
};

const compareKeys = ({ left, right }: CompareParams): number => {
  for (const [index, value] of left.entries()) {
    const other = right[index] ?? 0;
    if (value !== other) {
      return value - other;
    }
  }
  return 0;
};

type Params = {
  readonly list: CandidateList;
  readonly batch?: ReadonlyArray<ProviderId>;
};

export const bestCandidate = ({ list, batch = [] }: Params): Candidate | null => {
  const valid = list.rows.filter((row) => row.cause === null);
  if (list.isPinned) {
    return valid[0] ?? null;
  }
  const ranked = valid
    .map((row) => ({ row, key: sortKey({ row, list, batch }) }))
    .sort((left, right) => compareKeys({ left: left.key, right: right.key }));
  return ranked[0]?.row ?? null;
};
