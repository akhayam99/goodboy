import { Switch } from '@goodboy/ui';
import { useIsWorkOn } from '../../../../../shared/hooks/useIsWorkOn';
import { SETTING_WORK_ENABLED } from '../../../../../shared/lib/workSetting';
import { NAMES } from '../../../../../shared/utils/names';
import { useAppSettingSave } from '../../../hooks/useAppSettingSave';
import { SWITCH_SETTING } from '../../../switchSetting';
import { SettingRow } from '../SettingRow';

const HELP = 'Adds the Work section and one composer for runs. Auto becomes Lead.';

export const WorkSwitchField = () => {
  const save = useAppSettingSave({
    settingKey: SETTING_WORK_ENABLED,
    saved: useIsWorkOn(),
    ...SWITCH_SETTING,
    failureTitle: "Couldn't save the Work setting",
  });

  return (
    <SettingRow
      label={NAMES.work}
      rowKey="work"
      help={HELP}
      isChanged={save.value}
      onReset={() => void save.save({ value: false })}
      save={save}
    >
      <Switch
        ariaLabel={NAMES.work}
        checked={save.value}
        onChange={(isOn) => void save.save({ value: isOn })}
      />
    </SettingRow>
  );
};
