import type { DiffComment, PrComment } from '@goodboy/types';
import { commentPlaceOf } from './commentPlaceOf';
import { commentRunHeadsOf } from './commentRunHeadsOf';

type Params = {
  readonly threadIds: ReadonlyArray<string>;
  readonly notes: ReadonlyArray<DiffComment>;
  readonly comments: ReadonlyArray<PrComment>;
};

export const commentRunPlacesOf = ({
  threadIds,
  notes,
  comments,
}: Params): Readonly<Record<string, string>> => {
  const places: Record<string, string> = {};
  for (const { threadId, head } of commentRunHeadsOf({ threadIds, notes, comments })) {
    const place =
      head === null ? null : commentPlaceOf({ path: head.path ?? null, line: head.line ?? null });
    if (place !== null) {
      places[threadId] = place;
    }
  }
  return places;
};
