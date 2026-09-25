import { AlertTriangle, CheckCheck, Inbox, RotateCcw } from 'lucide-react';
import { Button, EmptyState, FilledEmptyState } from '@goodboy/ui';
import { RESOLVE_QUEUE_RETRYABLE_EMPTY } from '../../resolveQueueCopy';

type NothingWaitingProps = {
  readonly hasOtherActiveWork: boolean;
};

export const NothingWaitingState = ({ hasOtherActiveWork }: NothingWaitingProps) => (
  <FilledEmptyState
    icon={CheckCheck}
    tone="neutral"
    title={hasOtherActiveWork ? 'No comments need review' : 'No open comments on GitHub'}
  />
);

export const NothingToRetryState = () => (
  <FilledEmptyState icon={RotateCcw} tone="neutral" title={RESOLVE_QUEUE_RETRYABLE_EMPTY} />
);

type NoPullRequestProps = {
  readonly onOpenReview: () => void;
};

export const NoResolveTargetState = ({ onOpenReview }: NoPullRequestProps) => (
  <EmptyState
    icon={Inbox}
    title="No pull request"
    description="Open Review to create or select a pull request."
    action={
      <Button size="sm" variant="secondary" onClick={onOpenReview}>
        Open review
      </Button>
    }
  />
);

type ErrorProps = {
  readonly message: string;
  readonly onRetry: () => void;
};

export const ResolveQueueErrorState = ({ message, onRetry }: ErrorProps) => (
  <EmptyState
    icon={AlertTriangle}
    tone="danger"
    title="Couldn't read comments from GitHub"
    description={`gh returned: ${message}`}
    action={
      <Button size="sm" variant="secondary" onClick={onRetry}>
        Retry
      </Button>
    }
  />
);
