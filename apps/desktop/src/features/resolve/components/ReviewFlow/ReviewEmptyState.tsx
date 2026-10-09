import { CheckCheck } from 'lucide-react';
import { EmptyState } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { NoPullRequestState } from './NoPullRequestState';

type Props = {
  readonly sessionId: SessionId;
  readonly provider: string | null;
};

export const ReviewEmptyState = ({ sessionId, provider }: Props) =>
  provider === null ? (
    <NoPullRequestState sessionId={sessionId} />
  ) : (
    <EmptyState
      size="section"
      icon={CheckCheck}
      tone="neutral"
      title={`No open comments on ${provider}`}
    />
  );
