import { useEffect } from 'react';
import { Band, FieldRow, Switch } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { NOTHING_CHANGED, READ_FAILED } from '../../../../store/slices/notifications/errorRecovery';
import { SETTING_TERMINAL_EXIT_STATUS } from '../../settings';

const LABEL = 'Show if a command passed or failed';

type ChangeParams = {
  readonly isOn: boolean;
};

export const TerminalExitStatusBand = () => {
  const raw = useAppStore((state) => state.settings[SETTING_TERMINAL_EXIT_STATUS]);
  const loadSetting = useAppStore((state) => state.loadSetting);
  const saveSetting = useAppStore((state) => state.saveSetting);
  const reportError = useAppStore((state) => state.reportError);

  useEffect(() => {
    if (raw !== undefined) {
      return;
    }
    loadSetting(SETTING_TERMINAL_EXIT_STATUS).catch((error: unknown) => {
      void reportError({
        title: "Couldn't read the terminal setting",
        error,
        recovery: READ_FAILED,
        severity: 'warning',
      });
    });
  }, [raw, loadSetting, reportError]);

  const onChange = async ({ isOn }: ChangeParams) => {
    try {
      await saveSetting(SETTING_TERMINAL_EXIT_STATUS, isOn ? 'true' : 'false');
    } catch (error) {
      void reportError({
        title: "Couldn't save the terminal setting",
        error,
        recovery: NOTHING_CHANGED,
      });
    }
  };

  return (
    <Band inset="content" label="Built-in terminal" headingLevel={2}>
      <div className="flex flex-col">
        <FieldRow label={LABEL} help="A small zsh hook; your own shell files stay untouched.">
          <Switch
            ariaLabel={LABEL}
            checked={raw !== 'false'}
            onChange={(isOn) => void onChange({ isOn })}
          />
        </FieldRow>
      </div>
    </Band>
  );
};
