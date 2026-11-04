import type { TranscriptInsertion } from '../../../../shared/types/transcriptInsertion';

type Params = {
  readonly insertions: ReadonlyArray<TranscriptInsertion>;
  readonly placed: ReadonlySet<string>;
  readonly beforeMs: number | null;
};

export const dueInsertionsOf = ({
  insertions,
  placed,
  beforeMs,
}: Params): ReadonlyArray<TranscriptInsertion> =>
  insertions.filter(
    (insertion) =>
      !placed.has(insertion.key) &&
      (beforeMs === null || (insertion.beforeMs !== null && insertion.beforeMs <= beforeMs)),
  );
