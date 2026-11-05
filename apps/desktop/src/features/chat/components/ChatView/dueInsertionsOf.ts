import type { TranscriptInsertion } from '../../../../shared/types/transcriptInsertion';

type Params<Insertion extends TranscriptInsertion> = {
  readonly insertions: ReadonlyArray<Insertion>;
  readonly placed: ReadonlySet<string>;
  readonly beforeMs: number | null;
};

export const dueInsertionsOf = <Insertion extends TranscriptInsertion>({
  insertions,
  placed,
  beforeMs,
}: Params<Insertion>): ReadonlyArray<Insertion> =>
  insertions.filter(
    (insertion) =>
      !placed.has(insertion.key) &&
      (beforeMs === null || (insertion.beforeMs !== null && insertion.beforeMs <= beforeMs)),
  );
