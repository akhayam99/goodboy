type RunParams<T> = {
  readonly key: string;
  readonly task: () => Promise<T>;
};

export type KeyedQueue = {
  readonly run: <T>(params: RunParams<T>) => Promise<T>;
};

export const createKeyedQueue = (): KeyedQueue => {
  const tails = new Map<string, Promise<void>>();
  const run = async <T>({ key, task }: RunParams<T>): Promise<T> => {
    const previous = tails.get(key) ?? Promise.resolve();
    const started = previous.then(task, task);
    const settled = started.then(
      () => undefined,
      () => undefined,
    );
    tails.set(key, settled);
    try {
      return await started;
    } finally {
      if (tails.get(key) === settled) {
        tails.delete(key);
      }
    }
  };
  return { run };
};
