export type ChapterHintProgress = {
  readonly tried: ReadonlyArray<string>;
  readonly skipped: ReadonlyArray<string>;
  readonly epoch: number;
};

export type HintProgress = Readonly<Record<string, ChapterHintProgress>>;
