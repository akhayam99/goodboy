export type LeadTreeGuide = Readonly<{
  level: number;
  trunks: ReadonlyArray<boolean>;
  hasNext: boolean;
  hasChildren: boolean;
}>;

type Params = {
  readonly levels: ReadonlyArray<number>;
};

type IndexParams = {
  readonly index: number;
};

export const leadTreeGuidesOf = ({ levels }: Params): ReadonlyArray<LeadTreeGuide> => {
  const hasNextAt = ({ index }: IndexParams): boolean => {
    const level = levels[index] ?? 0;
    for (let next = index + 1; next < levels.length; next += 1) {
      const nextLevel = levels[next] ?? 0;
      if (nextLevel < level) {
        return false;
      }
      if (nextLevel === level) {
        return true;
      }
    }
    return false;
  };
  const openByLevel: boolean[] = [];
  return levels.map((level, index) => {
    const hasNext = hasNextAt({ index });
    openByLevel.length = level;
    const trunks = Array.from({ length: Math.max(0, level - 1) }, (_, at) => {
      return openByLevel[at + 1] ?? false;
    });
    openByLevel[level] = hasNext;
    return {
      level,
      trunks,
      hasNext,
      hasChildren: (levels[index + 1] ?? 0) > level,
    };
  });
};
