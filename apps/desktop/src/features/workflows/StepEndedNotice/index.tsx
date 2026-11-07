import { CHECK_STATE } from '../../../store/slices/notifications/errorRecovery';
import { useState } from 'react';
import { Check } from 'lucide-react';
import { Button, ICON_SIZE, Notice } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { STEP_ENDED_COPY } from '../stepEndedCopy';
import { useStepEndedWithoutResult } from './useStepEndedWithoutResult';

type Props = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

export const StepEndedNotice = ({ sessionId, agentId }: Props) => {
  const isEnded = useStepEndedWithoutResult({ sessionId, agentId });
  const markStepDone = useAppStore((state) => state.markStepDone);
  const reportError = useAppStore((state) => state.reportError);
  const [isBusy, setIsBusy] = useState(false);
  if (!isEnded) {
    return null;
  }

  const markDone = async () => {
    if (isBusy) {
      return;
    }
    setIsBusy(true);
    try {
      await markStepDone({ sessionId, agentId });
    } catch (error) {
      await reportError({
        recovery: CHECK_STATE,
        title: STEP_ENDED_COPY.markDoneFailed,
        error,
        sessionId,
      });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <section
      aria-label={STEP_ENDED_COPY.title}
      data-step-ended-without-result={agentId}
      className="min-w-0"
    >
      <Notice
        tone="warning"
        placement="inline"
        title={STEP_ENDED_COPY.title}
        body={STEP_ENDED_COPY.body}
        actions={
          <Button
            size="sm"
            variant="quiet"
            isBusy={isBusy}
            disabled={isBusy}
            onClick={() => void markDone()}
          >
            <Check size={ICON_SIZE.row} aria-hidden />
            {STEP_ENDED_COPY.markDoneAction}
          </Button>
        }
      />
    </section>
  );
};
