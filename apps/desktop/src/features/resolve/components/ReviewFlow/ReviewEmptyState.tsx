import { CheckCheck, MessageSquare } from 'lucide-react';
import { EmptyState, FilledEmptyState } from '@goodboy/ui';

type Props = {
  readonly provider: string | null;
};

export const ReviewEmptyState = ({ provider }: Props) =>
  provider === null ? (
    <EmptyState icon={MessageSquare} title="No open notes" />
  ) : (
    <FilledEmptyState icon={CheckCheck} tone="neutral" title={`No open comments on ${provider}`} />
  );
