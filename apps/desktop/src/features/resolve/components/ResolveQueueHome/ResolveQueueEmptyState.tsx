import { AlertTriangle, CheckCheck, MessageSquare } from 'lucide-react';
import { Button, EmptyState, FilledEmptyState } from '@goodboy/ui';

export const NothingWaitingState = () => (
  <FilledEmptyState icon={CheckCheck} tone="neutral" title="No open comments on GitHub" />
);

export const NoOpenNotesState = () => (
  <EmptyState
    icon={MessageSquare}
    title="No open notes"
    description="Leave a note on a line in the diff. It shows up here, ready to resolve."
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
