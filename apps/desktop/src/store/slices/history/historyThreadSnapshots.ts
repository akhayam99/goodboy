import type { HistoryShaMove } from '@goodboy/types';
import type { HistoryThreadShas } from './types';

type Params = {
  readonly threadShas: ReadonlyArray<HistoryThreadShas>;
  readonly map: ReadonlyArray<HistoryShaMove>;
};

type ShaParams = { readonly sha: string | null };

export const historyThreadSnapshots = ({ threadShas, map }: Params) => {
  const moves = new Map(
    map.filter((move) => move.from !== move.to).map((move) => [move.from, move.to]),
  );
  const mappedSha = ({ sha }: ShaParams): string | null => {
    if (sha === null) {
      return null;
    }
    if (!moves.has(sha)) {
      return sha;
    }
    return moves.get(sha) ?? null;
  };
  const before = threadShas.filter(
    (thread) =>
      thread.commitShas.some((sha) => moves.has(sha)) ||
      (thread.fixupOfSha !== null && moves.has(thread.fixupOfSha)) ||
      (thread.replacesSha !== null && moves.has(thread.replacesSha)),
  );
  const after = before.map((thread) => ({
    ...thread,
    commitShas: [
      ...new Set(
        thread.commitShas
          .map((sha) => mappedSha({ sha }))
          .filter((sha): sha is string => sha !== null),
      ),
    ],
    fixupOfSha: mappedSha({ sha: thread.fixupOfSha }),
    replacesSha: mappedSha({ sha: thread.replacesSha }),
  }));
  return { before, after };
};
