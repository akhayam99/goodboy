import { useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { SessionId, WorkflowAutonomy, WorkflowRun } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { runAutonomyOf } from '../../runAutonomy';
import { AsksYouChip } from '../../AsksYouChip';
import type { RunSettingWords } from './runSettingsOf';

type Props = {
  readonly sessionId: SessionId;
  readonly run: WorkflowRun;
  readonly words: RunSettingWords;
};

type PickParams = {
  readonly next: WorkflowAutonomy;
};

const HELP = 'When the run stops and waits for your go. A change applies from the next step.';

export const RunAsksSetting = ({ sessionId, run, words }: Props) => {
  const setWorkflowRunAutonomy = useAppStore((state) => state.setWorkflowRunAutonomy);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<WorkflowAutonomy | null>(null);
  const current = runAutonomyOf({ autoRun: run.autoRun, autonomy: run.rulesSnapshot?.autonomy });
  const pick = async ({ next }: PickParams) => {
    if (next === current.key || pending !== null) {
      return;
    }
    setPending(next);
    setError(null);
    try {
      await setWorkflowRunAutonomy(sessionId, run.id, next);
    } catch (failure) {
      setError(`Couldn't change it. ${formatError(failure)}`);
    } finally {
      setPending(null);
    }
  };
  return (
    <AsksYouChip
      value={current.key}
      words={words}
      help={HELP}
      error={error}
      isDisabled={pending !== null}
      onPick={({ next }) => void pick({ next })}
    />
  );
};
