import { useState } from 'react';
import { FieldRow, Switch } from '@goodboy/ui';
import { useAppStore } from '../../../../../store';
import { useIsWorkOn } from '../../../../../shared/hooks/useIsWorkOn';
import { NOTHING_CHANGED } from '../../../../../store/slices/notifications/errorRecovery';
import { SETTING_WORK_ENABLED } from '../../../../../shared/lib/workSetting';

const HELP =
  'Adds the Work section, starts runs from one composer and names the agent that leads a run Lead instead of Auto. Running work keeps its rules when you turn it off.';

type SaveParams = {
  readonly isOn: boolean;
};

export const WorkSwitchField = () => {
  const isWorkOn = useIsWorkOn();
  const saveSetting = useAppStore((state) => state.saveSetting);
  const reportError = useAppStore((state) => state.reportError);
  const [error, setError] = useState<string | null>(null);

  const save = async ({ isOn }: SaveParams) => {
    try {
      await saveSetting(SETTING_WORK_ENABLED, isOn ? 'true' : 'false');
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't save this setting.");
      void reportError({
        title: "Couldn't save the Work setting",
        error: caught,
        recovery: NOTHING_CHANGED,
      });
    }
  };

  return (
    <FieldRow
      label="Work (experimental)"
      help={
        error === null ? (
          HELP
        ) : (
          <span role="alert" className="text-danger">
            {error}
          </span>
        )
      }
    >
      <Switch
        ariaLabel="Work (experimental)"
        checked={isWorkOn}
        onChange={(isOn) => void save({ isOn })}
      />
    </FieldRow>
  );
};
