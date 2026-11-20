const ACTION_RETRY_LIMIT = 50;

export type ActionRetry = () => Promise<boolean>;

const retries = new Map<string, ActionRetry>();

type RegisterParams = {
  readonly retry: ActionRetry;
};

export const registerActionRetry = ({ retry }: RegisterParams): string => {
  const retryId = crypto.randomUUID();
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
