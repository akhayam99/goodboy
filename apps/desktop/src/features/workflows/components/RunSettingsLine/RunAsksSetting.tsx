import type { SessionId, WorkflowRun } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { runAutonomyOf } from '../../runAutonomy';
import { useAutonomyPick } from '../../hooks/useAutonomyPick';
import { AsksYouChip } from '../../AsksYouChip';
import type { RunSettingWords } from './runSettingsOf';

type Props = {
  readonly sessionId: SessionId;
  readonly run: WorkflowRun;
  readonly words: RunSettingWords;
};

const HELP = 'When the run stops and waits for your go. A change applies from the next step.';

export const RunAsksSetting = ({ sessionId, run, words }: Props) => {
  const setWorkflowRunAutonomy = useAppStore((state) => state.setWorkflowRunAutonomy);
  const current = runAutonomyOf({ autoRun: run.autoRun, autonomy: run.rulesSnapshot?.autonomy });
  const { error, isBusy, pick } = useAutonomyPick({
    current: current.key,
    save: ({ next }) => setWorkflowRunAutonomy(sessionId, run.id, next),
  });
  return (
    <AsksYouChip
      value={current.key}
      words={words}
      help={HELP}
      error={error}
      isDisabled={isBusy}
      onPick={({ next }) => void pick({ next })}
    />
  );
};
