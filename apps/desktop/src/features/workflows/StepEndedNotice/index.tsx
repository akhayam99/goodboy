import { useState, type ReactNode } from 'react';
import { Check, MessageCircle } from 'lucide-react';
import { Button, ICON_SIZE, Notice } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { STEP_ENDED_COPY } from '../stepEndedCopy';
import { useStepEndedWithoutResult } from './useStepEndedWithoutResult';

type Props = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly fallback?: ReactNode;
};

type Action = 'continue' | 'done';

type PressParams = {
  readonly action: Action;
  readonly failure: string;
};

export const StepEndedNotice = ({ sessionId, agentId, fallback = null }: Props) => {
  const isEnded = useStepEndedWithoutResult({ sessionId, agentId });
  const askAgentToContinue = useAppStore((state) => state.askAgentToContinue);
  const markStepDone = useAppStore((state) => state.markStepDone);
  const reportError = useAppStore((state) => state.reportError);
  const [busy, setBusy] = useState<Action | null>(null);
  if (!isEnded) {
    return fallback;
  }

  const press = async ({ action, failure }: PressParams) => {
    if (busy !== null) {
      return;
    }
    setBusy(action);
    try {
      if (action === 'continue') {
        await askAgentToContinue({ sessionId, agentId });
        return;
      }
      await markStepDone({ sessionId, agentId });
    } catch (error) {
      await reportError({ title: failure, error, sessionId });
    } finally {
      setBusy(null);
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
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              isBusy={busy === 'continue'}
              disabled={busy !== null}
              onClick={() =>
                void press({ action: 'continue', failure: STEP_ENDED_COPY.continueFailed })
              }
            >
              <MessageCircle size={ICON_SIZE.row} aria-hidden />
              {STEP_ENDED_COPY.continueAction}
            </Button>
            <Button
              size="sm"
              variant="quiet"
              isBusy={busy === 'done'}
              disabled={busy !== null}
              onClick={() =>
                void press({ action: 'done', failure: STEP_ENDED_COPY.markDoneFailed })
              }
            >
              <Check size={ICON_SIZE.row} aria-hidden />
              {STEP_ENDED_COPY.markDoneAction}
            </Button>
          </div>
        }
      />
    </section>
  );
};
