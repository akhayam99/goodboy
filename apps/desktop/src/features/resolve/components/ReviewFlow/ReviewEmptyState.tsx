import { CheckCheck, MessageSquare } from 'lucide-react';
import { EmptyState, FilledEmptyState } from '@goodboy/ui';

type Props = {
  readonly provider: string | null;
};

export const ReviewEmptyState = ({ provider }: Props) =>
  provider === null ? (
    <EmptyState
      icon={MessageSquare}
      title="No open notes"
      description="Leave a note on a line in the diff. It shows up here, ready for an agent."
    />
  ) : (
    <FilledEmptyState icon={CheckCheck} tone="neutral" title={`No open comments on ${provider}`} />
  );
