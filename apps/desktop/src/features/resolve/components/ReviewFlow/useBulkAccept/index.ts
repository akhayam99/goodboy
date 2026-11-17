import { useCallback, useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { isReportedError } from '../../../../../store/slices/notifications/reportedError';
import { REVIEW_BULK_LABEL, bulkAcceptFailureLine } from '../../../reviewBulkCopy';

type Params = {
  readonly sessionId: SessionId;
};

export type BulkError = {
  readonly title: string;
  readonly body: string;
};

export const useBulkAccept = ({ sessionId }: Params) => {
  const acceptReviewComments = useAppStore((s) => s.acceptReviewComments);
  const undoReviewAccepts = useAppStore((s) => s.undoReviewAccepts);
  const clearReviewSelection = useAppStore((s) => s.clearReviewSelection);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const [error, setError] = useState<BulkError | null>(null);

  const accept = useCallback(
    async (threadIds: ReadonlyArray<string>): Promise<void> => {
      if (isAccepting || threadIds.length === 0) {
        return;
      }
      setIsAccepting(true);
      setError(null);
      try {
        const result = await acceptReviewComments({ sessionId, threadIds });
        clearReviewSelection({ sessionId });
        const [first] = result.failures;
        if (first !== undefined) {
          setError({
            title: REVIEW_BULK_LABEL.acceptFailed,
            body: bulkAcceptFailureLine({ count: result.failures.length, message: first.message }),
          });
        }
      } catch (caught) {
        if (!isReportedError(caught)) {
          setError({ title: REVIEW_BULK_LABEL.acceptFailed, body: formatError(caught) });
        }
      } finally {
        setIsAccepting(false);
      }
    },
    [acceptReviewComments, clearReviewSelection, isAccepting, sessionId],
  );

  const undo = useCallback(async (): Promise<void> => {
    if (isUndoing) {
      return;
    }
    setIsUndoing(true);
    setError(null);
    try {
      await undoReviewAccepts({ sessionId });
    } catch (caught) {
      if (!isReportedError(caught)) {
        setError({ title: REVIEW_BULK_LABEL.undoFailed, body: formatError(caught) });
      }
    } finally {
      setIsUndoing(false);
    }
  }, [isUndoing, sessionId, undoReviewAccepts]);

  return { accept, undo, isAccepting, isUndoing, error };
};
