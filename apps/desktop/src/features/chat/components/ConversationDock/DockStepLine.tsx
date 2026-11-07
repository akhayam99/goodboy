import { useState } from 'react';
import { Button } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { DockStateLine } from '../../../../shared/components/DockStateLine';
import { NAMES } from '../../../../shared/utils/names';
import { useAppStore } from '../../../../store';
import { ORCHESTRATED_COPY } from '../../../workflows/orchestratedCopy';
import { runStateFromKind } from '../../../workflows/runStateOf';
import type { BlockedStepAnswer } from '../ChatInput/hooks/useBlockedStepAnswer';

type Props = {
  readonly sessionId: SessionId;
  readonly step: BlockedStepAnswer;
};

const RETRY_FAILED = "Couldn't retry the step";

export const DockStepLine = ({ sessionId, step }: Props) => {
  const recoverStuckStep = useAppStore((state) => state.recoverStuckStep);
  const reportError = useAppStore((state) => state.reportError);
  const [isRetrying, setIsRetrying] = useState(false);
  const isBusy = isRetrying || step.isSending;

  const retry = async (): Promise<void> => {
    if (isBusy) {
      return;
    }
    setIsRetrying(true);
    try {
      await recoverStuckStep({ sessionId, workflowRunId: step.runId });
    } catch (error) {
      await reportError({ title: RETRY_FAILED, error, sessionId });
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <DockStateLine
      state="step-not-finished"
      tone="warning"
      sentence={runStateFromKind({ kind: 'halted-blocked' }).word}
      note={step.error === null ? null : `${ORCHESTRATED_COPY.blockedAnswerFailed}: ${step.error}`}
    >
      <Button
        variant="secondary"
        size="sm"
        isBusy={isRetrying}
        busyLabel="Retrying"
        disabled={isBusy}
        onClick={() => void retry()}
      >
        {NAMES.retry}
      </Button>
      <Button
        variant="primary"
        size="sm"
        isBusy={step.isSending}
        disabled={isBusy}
        onClick={() => void step.send()}
      >
        {NAMES.continue}
      </Button>
    </DockStateLine>
  );
};
