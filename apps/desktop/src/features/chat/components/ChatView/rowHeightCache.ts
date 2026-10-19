const MAX_ENTRIES = 5000;

const heights = new Map<string, number>();

type ReadParams = {
  readonly key: string;
};

type WriteParams = {
  readonly key: string;
  readonly px: number;
};

export const rowHeightCache = {
  read: ({ key }: ReadParams): number | undefined => heights.get(key),
  write: ({ key, px }: WriteParams): void => {
    heights.delete(key);
    heights.set(key, Math.round(px));
    if (heights.size <= MAX_ENTRIES) {
      return;
    }
    const oldest = heights.keys().next();
    if (oldest.done !== true) {
      heights.delete(oldest.value);
    }
  },
};
