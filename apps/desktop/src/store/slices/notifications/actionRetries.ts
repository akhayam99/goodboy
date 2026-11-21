const ACTION_RETRY_LIMIT = 50;

export type ActionRetry = () => Promise<boolean>;

const retries = new Map<string, ActionRetry>();

const running = new Map<string, Promise<boolean>>();

type RegisterParams = {
  readonly retry: ActionRetry;
  readonly retryId?: string;
};

export const registerActionRetry = ({
  retry,
  retryId = crypto.randomUUID(),
}: RegisterParams): string => {
  retries.delete(retryId);
  retries.set(retryId, retry);
  for (const oldest of retries.keys()) {
    if (retries.size <= ACTION_RETRY_LIMIT) {
      break;
    }
    retries.delete(oldest);
  }
  return retryId;
};

type LookupParams = {
  readonly retryId: string;
};

export const actionRetryOf = ({ retryId }: LookupParams): ActionRetry | undefined =>
  retries.get(retryId);

export const runActionRetry = ({ retryId }: LookupParams): Promise<boolean> => {
  const current = running.get(retryId);
  if (current !== undefined) {
    return current;
  }
  const retry = retries.get(retryId);
  if (retry === undefined) {
    return Promise.resolve(false);
  }
  const run = retry()
    .then((isDone) => {
      if (isDone && retries.get(retryId) === retry) {
        retries.delete(retryId);
      }
      return isDone;
    })
    .finally(() => {
      running.delete(retryId);
    });
  running.set(retryId, run);
  return run;
};
