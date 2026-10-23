export type ChapterHintProgress = {
  readonly tried: ReadonlyArray<string>;
  readonly skipped: ReadonlyArray<string>;
};

export type HintProgress = Readonly<Record<string, ChapterHintProgress>>;
