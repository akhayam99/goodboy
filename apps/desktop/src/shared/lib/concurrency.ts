type Params<Item> = {
  readonly items: ReadonlyArray<Item>;
  readonly limit: number;
  readonly run: (item: Item) => Promise<void>;
};

export const runWithConcurrency = async <Item>({
  items,
  limit,
  run,
}: Params<Item>): Promise<void> => {
  const queue = [...items];
  const workerCount = Math.max(1, Math.min(limit, queue.length));
  const workers = Array.from({ length: workerCount }, async () => {
    for (;;) {
      const item = queue.shift();
      if (item === undefined) {
        return;
      }
      await run(item);
    }
  });
  await Promise.all(workers);
};
