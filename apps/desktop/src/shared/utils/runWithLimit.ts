type RunWithLimitParams<T> = {
  readonly tasks: ReadonlyArray<() => Promise<T>>;
  readonly limit: number;
};

export const runWithLimit = async <T>({
  tasks,
  limit,
}: RunWithLimitParams<T>): Promise<ReadonlyArray<T>> => {
  const results: Array<T> = [];
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < tasks.length) {
      const index = next;
      next += 1;
      const task = tasks[index];
      if (task === undefined) {
        continue;
      }
      results[index] = await task();
    }
  };
  const workerCount = Math.max(1, Math.min(limit, tasks.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
};
