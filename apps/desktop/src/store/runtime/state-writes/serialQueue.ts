type RunParams<Value> = {
  readonly key: string;
  readonly task: () => Promise<Value>;
};

export type SerialQueue = {
  readonly run: <Value>(params: RunParams<Value>) => Promise<Value>;
};

const settled = (): void => undefined;

export const createSerialQueue = (): SerialQueue => {
  const tails = new Map<string, Promise<void>>();
  return {
    run: <Value>({ key, task }: RunParams<Value>): Promise<Value> => {
      const previous = tails.get(key) ?? Promise.resolve();
      const result = previous.then(task);
      const tail = result.then(settled, settled);
      tails.set(key, tail);
      void tail.then(() => {
        if (tails.get(key) === tail) {
          tails.delete(key);
        }
      });
      return result;
    },
  };
};
