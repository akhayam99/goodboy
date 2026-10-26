type RunParams<T> = {
  readonly key: string;
  readonly task: () => Promise<T>;
};

export type DedupeByKey<T> = {
  readonly run: (params: RunParams<T>) => Promise<T>;
  readonly size: () => number;
};

export const createDedupeByKey = <T>(): DedupeByKey<T> => {
  const inFlight = new Map<string, Promise<T>>();
  const run = ({ key, task }: RunParams<T>): Promise<T> => {
    const running = inFlight.get(key);
    if (running !== undefined) {
      return running;
    }
    const started = task().finally(() => {
      inFlight.delete(key);
    });
    inFlight.set(key, started);
    return started;
  };
  return { run, size: () => inFlight.size };
};
