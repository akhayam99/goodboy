import { classifyProviderError } from '../../../../features/chat/classifyProviderError';
import type { TurnFailureReason } from '../types';

type Params = {
  readonly message: string;
};

export const turnFailureReasonOf = ({ message }: Params): TurnFailureReason | null => {
  const failure = classifyProviderError({ message });
  if (failure.kind === 'model_not_available' || failure.kind === 'authentication') {
    return failure.kind;
  }
  return null;
};
