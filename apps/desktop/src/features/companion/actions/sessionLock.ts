const tails = new Map<string, Promise<unknown>>();

type LockParams<Result> = {
  readonly key: string;
  readonly work: () => Promise<Result>;
};

export const serializedBy = <Result>({ key, work }: LockParams<Result>): Promise<Result> => {
  const previous = tails.get(key) ?? Promise.resolve();
  const next = previous.then(work, work);
  const tail = next.then(
    () => undefined,
    () => undefined,
  );
  tails.set(key, tail);
  void tail.then(() => {
    if (tails.get(key) === tail) {
      tails.delete(key);
    }
  });
  return next;
};
