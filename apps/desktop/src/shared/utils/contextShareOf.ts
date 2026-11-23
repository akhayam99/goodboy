type Params = {
  readonly tokens: number | null;
  readonly window: number | null;
};

export const contextShareOf = ({ tokens, window }: Params): number | null => {
  if (tokens === null || window === null || window <= 0) {
    return null;
  }
  return Math.min(1, tokens / window);
};
