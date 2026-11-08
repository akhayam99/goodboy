export type FilesFact = {
  readonly text: string | null;
  readonly count: number | null;
  readonly diff: {
    readonly additions: number;
    readonly deletions: number;
  } | null;
};
