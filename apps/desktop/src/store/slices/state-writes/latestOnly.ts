export type LatestOutcome = 'applied' | 'stale';

type RunParams<Value> = {
  readonly key: string;
  readonly request: () => Promise<Value>;
  readonly apply: (value: Value) => void;
};

type CancelParams = {
  readonly key: string;
};

export type LatestOnly = {
  readonly run: <Value>(params: RunParams<Value>) => Promise<LatestOutcome>;
  readonly cancel: (params: CancelParams) => void;
};

export const createLatestOnly = (): LatestOnly => {
  const tokens = new Map<string, number>();
  const next = ({ key }: CancelParams): number => {
    const token = (tokens.get(key) ?? 0) + 1;
    tokens.set(key, token);
    return token;
  };
  return {
    run: async <Value>({ key, request, apply }: RunParams<Value>): Promise<LatestOutcome> => {
      const token = next({ key });
      let value: Value;
      try {
        value = await request();
      } catch (error) {
        if (tokens.get(key) !== token) {
          return 'stale';
        }
        throw error;
      }
      if (tokens.get(key) !== token) {
        return 'stale';
      }
      apply(value);
      return 'applied';
    },
    cancel: ({ key }) => {
      next({ key });
    },
  };
};
