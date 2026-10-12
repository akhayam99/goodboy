import type { PushFailedError } from './pushFailedError';
import { pushFailures } from './pushFailures';

type Params = {
  readonly error: unknown;
};

export const pushFailureOf = ({ error }: Params): PushFailedError | null => {
  if (!(error instanceof Error)) {
    return null;
  }
  return pushFailures.get(error) ?? null;
};
