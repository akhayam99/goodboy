import { Button } from '@goodboy/ui';
import type { CloneFailure } from '../cloneFailureTypes';
import { cloneFailureLine } from '../cloneFailureLine';
import { isCloneRetryable } from '../isCloneRetryable';

type Props = {
  readonly failure: CloneFailure;
  readonly onRetry: () => void;
  readonly onUseSuggestion: () => void;
};

export const CloneFailureLine = ({ failure, onRetry, onUseSuggestion }: Props) => (
  <div role="alert" className="flex items-start justify-between gap-3">
    <p className="min-w-0 text-meta text-danger">{cloneFailureLine({ failure })}</p>
    {failure.suggestion === null ? null : (
      <Button variant="ghost" size="xs" onClick={onUseSuggestion}>
        {`Use ${failure.suggestion}`}
      </Button>
    )}
    {isCloneRetryable({ failure }) ? (
      <Button variant="ghost" size="xs" onClick={onRetry}>
        Retry
      </Button>
    ) : null}
  </div>
);
