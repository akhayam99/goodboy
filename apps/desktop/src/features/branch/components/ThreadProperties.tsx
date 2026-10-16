import { useMemo } from 'react';
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

const MIN_ATTEMPTS = 2;

export const ThreadProperties = ({ sessionId, entry }: Props) => {
  const { threadId, row } = entry;
  const attempts = useAppStore((s) => s.sessionResolveAttempts[sessionId] ?? EMPTY_ATTEMPTS);
  const attemptCount = useMemo(
    () => attempts.filter((attempt) => attempt.threadIds.includes(threadId)).length,
    [attempts, threadId],
  );
  const sha = conversationSha({ row });
  const isNote = row.thread.originKind === 'diff_comment';
  if (!isNote && attemptCount < MIN_ATTEMPTS && sha === null) {
    return null;
  }
  return (
    <div
      role="group"
      aria-label="Comment properties"
      className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1"
    >
      {isNote ? <ThreadPropertyRow label="Origin">Note on this machine</ThreadPropertyRow> : null}
      {attemptCount < MIN_ATTEMPTS ? null : (
        <ThreadPropertyRow label="Attempts">{attemptCount}</ThreadPropertyRow>
      )}
      {sha !== null && (
        <ThreadPropertyRow label="Fix">
          <span className="font-mono">{sha.slice(0, 7)}</span>
        </ThreadPropertyRow>
      )}
    </div>
  );
};
