import { useState } from 'react';
import { Button, FormActions, formatError } from '@goodboy/ui';
import type { SessionId, WorkflowRun } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { planChangeVerdictOf } from '../../../../store/slices/workflows/planChangeVerdictOf';
import { PRESET_CHANGE_COPY } from '../../../../store/slices/workflows/presetChangeCopy';
import type { PresetChangeAnswer } from '../../../../store/slices/workflows/resolvePresetChange';

type Props = {
  readonly sessionId: SessionId;
  readonly run: WorkflowRun;
};

export const PresetChangeAsk = ({ sessionId, run }: Props) => {
  const resolvePresetChange = useAppStore((state) => state.resolvePresetChange);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = run.rulesSnapshot?.pendingChange;
  if (run.orchestrationStop?.kind !== 'preset-change' || pending === undefined) {
    return null;
  }
  const isPinned = planChangeVerdictOf({ rules: run.rulesSnapshot, change: pending }) === 'pinned';

  const answer = async (choice: PresetChangeAnswer): Promise<void> => {
    setIsBusy(true);
    setError(null);
    try {
      await resolvePresetChange(sessionId, run.id, choice);
    } catch (cause) {
      setError(`${PRESET_CHANGE_COPY.failed}: ${formatError(cause)}`);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <section aria-label={PRESET_CHANGE_COPY.keep} className="flex min-w-0 flex-col gap-2">
      <p className="text-ui text-foreground">{run.orchestrationStop.message}</p>
      <FormActions error={error}>
        {isPinned ? null : (
          <Button size="sm" variant="ghost" disabled={isBusy} onClick={() => void answer('adapt')}>
            {PRESET_CHANGE_COPY.switchToAdapt}
          </Button>
        )}
        <Button size="sm" variant="ghost" disabled={isBusy} onClick={() => void answer('decline')}>
          {isPinned ? PRESET_CHANGE_COPY.keep : PRESET_CHANGE_COPY.decline[pending.kind]}
        </Button>
        {isPinned ? null : (
          <Button size="sm" disabled={isBusy} onClick={() => void answer('apply')}>
            {PRESET_CHANGE_COPY.apply[pending.kind]}
          </Button>
        )}
      </FormActions>
    </section>
  );
};
