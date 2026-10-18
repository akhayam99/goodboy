let pendingChapterId: string | null = null;

const listeners = new Set<() => void>();

export const requestGuideChapter = (id: string): void => {
  pendingChapterId = id;
  listeners.forEach((listener) => listener());
};

export const peekGuideChapter = (): string | null => pendingChapterId;

export const clearGuideChapter = (): void => {
  pendingChapterId = null;
};

type ListenParams = {
  readonly listener: () => void;
};

export const onGuideChapterRequest = ({ listener }: ListenParams): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
