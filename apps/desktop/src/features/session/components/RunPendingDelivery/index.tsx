import { useState } from 'react';
import { Button, Markdown, Notice } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { NAMES } from '../../../../shared/utils/names';
import { ORCHESTRATED_COPY } from '../../../workflows/orchestratedCopy';

type Props = {
  readonly sessionId: SessionId;
};

export const RunPendingDelivery = ({ sessionId }: Props) => {
  const pending = useAppStore((state) => state.pendingOpenQuestionDeliveries[sessionId]);
  const retryOpenQuestionDelivery = useAppStore((state) => state.retryOpenQuestionDelivery);
  const [isRetrying, setIsRetrying] = useState(false);

  if (pending === undefined) {
    return null;
  }

  const retry = async (): Promise<void> => {
    setIsRetrying(true);
    try {
      await retryOpenQuestionDelivery({ sessionId, attemptId: pending.attemptId });
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <section
      aria-label={ORCHESTRATED_COPY.answersNotDeliveredLabel}
      data-run-pending-delivery={pending.attemptId}
      className="flex min-w-0 flex-col gap-2"
    >
      {pending.pairs.map((pair) => (
        <div key={pair.id} className="flex min-w-0 flex-col gap-1 px-2">
          <Markdown text={pair.text} className="text-read text-foreground" />
          <p className="text-ui text-muted-foreground">{pair.answer}</p>
        </div>
      ))}
      <Notice
        tone="danger"
        placement="inline"
        role="alert"
        title={ORCHESTRATED_COPY.answersNotDeliveredTitle}
        body={pending.error}
        actions={
          <Button
            size="xs"
            variant="secondary"
            isBusy={isRetrying}
            disabled={isRetrying}
            onClick={() => void retry()}
          >
            {NAMES.retry}
          </Button>
        }
      />
    </section>
  );
};
