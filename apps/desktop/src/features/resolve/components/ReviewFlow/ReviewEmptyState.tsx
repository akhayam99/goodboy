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
      size="page"
      icon={CheckCheck}
      title="No open comments"
      description={`Nothing on ${provider} waits for an answer.`}
    />
  );
