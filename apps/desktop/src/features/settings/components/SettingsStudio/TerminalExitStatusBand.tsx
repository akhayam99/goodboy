import { useEffect } from 'react';
import { Band, Switch } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { READ_FAILED } from '../../../../store/slices/notifications/errorRecovery';
import { NAMES } from '../../../../shared/utils/names';
import { useAppSettingSave } from '../../hooks/useAppSettingSave';
import { SETTING_TERMINAL_EXIT_STATUS } from '../../settings';
import { SWITCH_SETTING } from '../../switchSetting';
import { SettingRow } from './SettingRow';

const HELP = 'A check or a cross after each command. Your dotfiles stay untouched.';

export const TerminalExitStatusBand = () => {
  const raw = useAppStore((state) => state.settings[SETTING_TERMINAL_EXIT_STATUS]);
  const loadSetting = useAppStore((state) => state.loadSetting);
  const reportError = useAppStore((state) => state.reportError);
  const save = useAppSettingSave({
    settingKey: SETTING_TERMINAL_EXIT_STATUS,
    saved: raw !== 'false',
    ...SWITCH_SETTING,
    failureTitle: "Couldn't save the terminal setting",
  });

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

  return (
    <Band inset="content" label="Built-in terminal" headingLevel={2}>
      <div className="flex flex-col">
        <SettingRow
          label={NAMES.commandStatus}
          rowKey="command-status"
          help={HELP}
          isChanged={!save.value}
          onReset={() => void save.save({ value: true })}
          save={save}
        >
          <Switch
            ariaLabel={NAMES.commandStatus}
            checked={save.value}
            onChange={(isOn) => void save.save({ value: isOn })}
          />
        </SettingRow>
      </div>
    </Band>
  );
};
