import { REVIEW_REFRESH_CONCURRENCY } from './requestRefreshConcurrency';

const waiting: Array<() => void> = [];
let running = 0;

type Params<T> = {
  readonly read: () => Promise<T>;
};

const release = (): void => {
  const next = waiting.shift();
  if (next === undefined) {
    running -= 1;
    return;
  }
  next();
};

const acquire = async (): Promise<void> => {
  if (running < REVIEW_REFRESH_CONCURRENCY) {
    running += 1;
    return;
  }
  await new Promise<void>((resolve) => {
    waiting.push(resolve);
  });
};

export const boundedThreadRead = async <T>({ read }: Params<T>): Promise<T> => {
  await acquire();
  try {
    return await read();
  } finally {
    release();
  }
};
