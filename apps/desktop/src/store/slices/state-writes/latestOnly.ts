type LatestOutcome = 'applied' | 'stale';

type RunParams<Value> = {
  readonly key: string;
  readonly request: () => Promise<Value>;
  readonly apply: (value: Value) => void;
};

type CancelParams = {
  readonly key: string;
};

export type LatestClaim = {
  readonly isCurrent: () => boolean;
};

export type LatestOnly = {
  readonly run: <Value>(params: RunParams<Value>) => Promise<LatestOutcome>;
  readonly claim: (params: CancelParams) => LatestClaim;
  readonly cancel: (params: CancelParams) => void;
};

export const createLatestOnly = (): LatestOnly => {
  const tokens = new Map<string, number>();
  const next = ({ key }: CancelParams): number => {
    const token = (tokens.get(key) ?? 0) + 1;
    tokens.set(key, token);
    return token;
  };
  const claim = ({ key }: CancelParams): LatestClaim => {
    const token = next({ key });
    return { isCurrent: () => tokens.get(key) === token };
  };
  return {
    run: async <Value>({ key, request, apply }: RunParams<Value>): Promise<LatestOutcome> => {
      const claimed = claim({ key });
      let value: Value;
      try {
        value = await request();
      } catch (error) {
        if (!claimed.isCurrent()) {
          return 'stale';
        }
        throw error;
      }
      if (!claimed.isCurrent()) {
        return 'stale';
      }
      apply(value);
      return 'applied';
    },
    claim,
    cancel: ({ key }) => {
      next({ key });
    },
  };
};
