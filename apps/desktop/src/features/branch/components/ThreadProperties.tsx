import { useMemo } from 'react';
import { REVIEW_SOURCE_LABEL } from '@goodboy/core';
import type { ResolveAttempt, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { conversationSha } from '../../resolve/conversationAgentResult';
import type { ReviewEntry } from '../../resolve/components/ReviewFlow/useReviewEntries';
import { ThreadPropertyRow } from './ThreadPropertyRow';

type Props = {
  readonly sessionId: SessionId;
  readonly entry: ReviewEntry;
};

const EMPTY_ATTEMPTS: ReadonlyArray<ResolveAttempt> = [];

export const ThreadProperties = ({ sessionId, entry }: Props) => {
  const { threadId, row } = entry;
  const attempts = useAppStore((s) => s.sessionResolveAttempts[sessionId] ?? EMPTY_ATTEMPTS);
  const attemptCount = useMemo(
    () => attempts.filter((attempt) => attempt.threadIds.includes(threadId)).length,
    [attempts, threadId],
  );
  const sha = conversationSha({ row });
  const origin = REVIEW_SOURCE_LABEL[row.thread.sourceKind ?? 'github'];
  return (
    <div
      role="group"
      aria-label="Comment properties"
      className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1"
    >
      <ThreadPropertyRow label="Origin">{origin}</ThreadPropertyRow>
      {attemptCount > 0 && <ThreadPropertyRow label="Attempts">{attemptCount}</ThreadPropertyRow>}
      {sha !== null && (
        <ThreadPropertyRow label="Fix">
          <span className="font-mono">{sha.slice(0, 7)}</span>
        </ThreadPropertyRow>
      )}
    </div>
  );
};
