let pendingChapterId: string | null = null;

export const requestGuideChapter = (id: string): void => {
  pendingChapterId = id;
};

export const peekGuideChapter = (): string | null => pendingChapterId;

export const clearGuideChapter = (): void => {
  pendingChapterId = null;
};
