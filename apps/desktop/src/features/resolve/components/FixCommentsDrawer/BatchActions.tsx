import { useState } from 'react';
import { Button, formatError } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { isReportedError } from '../../../../store/slices/notifications/reportedError';
import { applyFixesLabel, postRepliesLabel } from '../../commentOutcomeCopy';
import { postOutcomeReply } from '../../postOutcomeReply';
import type { ReviewEntry } from '../ReviewFlow/useReviewEntries';

export type BatchReply = {
  readonly entry: ReviewEntry;
  readonly reply: string;
};

type Props = {
  readonly sessionId: SessionId;
  readonly fixes: ReadonlyArray<ReviewEntry>;
  readonly replies: ReadonlyArray<BatchReply>;
};

export const BatchActions = ({ sessionId, fixes, replies }: Props) => {
  const acceptReviewComments = useAppStore((s) => s.acceptReviewComments);
  const [busy, setBusy] = useState<'fixes' | 'replies' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const guard = async (kind: 'fixes' | 'replies', step: () => Promise<void>): Promise<void> => {
    if (busy !== null) {
      return;
    }
    setBusy(kind);
    setError(null);
    try {
      await step();
    } catch (caught) {
      if (!isReportedError(caught)) {
        setError(formatError(caught));
      }
    } finally {
      setBusy(null);
    }
  };

  const applyAll = async (): Promise<void> => {
    const result = await acceptReviewComments({
      sessionId,
      threadIds: fixes.map((entry) => entry.threadId),
    });
    const [failure] = result.failures;
    if (failure !== undefined) {
      throw new Error(failure.message);
    }
  };

  const postAll = async (): Promise<void> => {
    for (const { entry, reply } of replies) {
      await postOutcomeReply({
        state: useAppStore.getState(),
        sessionId,
        threadId: entry.threadId,
        itemId: entry.row.item.id,
        revision: entry.row.thread.revision,
        reply,
        isOnRemote: entry.remote !== null,
      });
    }
  };

  if (fixes.length === 0 && replies.length === 0) {
    return null;
  }
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {fixes.length > 0 && (
          <Button
            size="sm"
            variant="primary"
            isBusy={busy === 'fixes'}
            disabled={busy !== null}
            onClick={() => void guard('fixes', applyAll)}
          >
            {applyFixesLabel({ count: fixes.length })}
          </Button>
        )}
        {replies.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            isBusy={busy === 'replies'}
            disabled={busy !== null}
            onClick={() => void guard('replies', postAll)}
          >
            {postRepliesLabel({ count: replies.length })}
          </Button>
        )}
      </div>
      {error !== null && (
        <p role="alert" className="text-meta text-danger">
          {error}
        </p>
      )}
    </div>
  );
};
