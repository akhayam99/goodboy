import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button, formatError } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { isReportedError } from '../../../../../store/slices/notifications/reportedError';
import {
  REVIEW_BULK_LABEL,
  recommendedAnswersLabel,
  retryCouldntFixLabel,
} from '../../../reviewBulkCopy';
import { retryableOf, type FixRun } from '../activeFixRun';
import { useBulkQuestions } from '../useBulkQuestions';

type Props = {
  readonly sessionId: SessionId;
  readonly run: FixRun;
  readonly onOpenAnswers: () => void;
};

const MIN_BULK_ANSWERS = 2;

export const RunStatusBulkActions = ({ sessionId, run, onOpenAnswers }: Props) => {
  const retryCouldntFix = useAppStore((s) => s.retryCouldntFix);
  const questions = useBulkQuestions({ sessionId, run });
  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const retryable = retryableOf({ run });
  const hasAnswers = questions.length >= MIN_BULK_ANSWERS;
  if (!hasAnswers && retryable.length === 0) {
    return null;
  }

  const retry = async (): Promise<void> => {
    if (isRetrying) {
      return;
    }
    setIsRetrying(true);
    setError(null);
    try {
      await retryCouldntFix({
        sessionId,
        launchId: run.launchId,
        threadIds: retryable.map((entry) => entry.threadId),
      });
    } catch (caught) {
      if (!isReportedError(caught)) {
        setError(formatError(caught));
      }
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div
      role="group"
      aria-label={REVIEW_BULK_LABEL.runActions}
      className="flex min-w-0 flex-wrap items-center justify-end gap-2"
    >
      {hasAnswers && (
        <Button size="sm" variant="secondary" onClick={onOpenAnswers}>
          {recommendedAnswersLabel({ count: questions.length })}
        </Button>
      )}
      {retryable.length > 0 && (
        <Button
          size="sm"
          variant="secondary"
          isBusy={isRetrying}
          onClick={() => void retry()}
          className="gap-2"
        >
          <RefreshCw size={ICON_SIZE.row} aria-hidden />
          {retryCouldntFixLabel({ count: retryable.length })}
        </Button>
      )}
      {error !== null && (
        <span role="status" className="min-w-0 truncate text-meta text-danger">
          {error}
        </span>
      )}
    </div>
  );
};
