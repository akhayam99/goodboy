import type { CloneFailure } from './cloneFailureTypes';

type Params = {
  readonly failure: CloneFailure;
};

export const isCloneRetryable = ({ failure }: Params): boolean =>
  failure.kind === 'network' || failure.kind === 'failed';
