import { isPrePushFailure } from '../../../shared/lib/isPrePushFailure';
import type { LocalCheckResult } from './state';

export type PushAnswer = {
  readonly error: string | null;
};

type Params = {
  readonly answer: PushAnswer;
  readonly at: number;
};

export const localCheckOf = ({ answer, at }: Params): LocalCheckResult | null => {
  if (answer.error === null) {
    return { outcome: 'passed', at, message: null };
  }
  if (!isPrePushFailure({ message: answer.error })) {
    return null;
  }
  return { outcome: 'declined', at, message: answer.error };
};
