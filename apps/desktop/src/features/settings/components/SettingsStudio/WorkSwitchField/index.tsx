import { Switch } from '@goodboy/ui';
import { useIsWorkOn } from '../../../../../shared/hooks/useIsWorkOn';
import { SETTING_WORK_ENABLED } from '../../../../../shared/lib/workSetting';
import { useAppSettingSave } from '../../../hooks/useAppSettingSave';
import { SWITCH_SETTING } from '../../../switchSetting';
import { SettingRow } from '../SettingRow';

const HELP =
  'Adds the Work section, starts runs from one composer and names the agent that leads a run Lead instead of Auto. Running work keeps its rules when you turn it off.';

export const WorkSwitchField = () => {
  const save = useAppSettingSave({
    settingKey: SETTING_WORK_ENABLED,
    saved: useIsWorkOn(),
    ...SWITCH_SETTING,
    failureTitle: "Couldn't save the Work setting",
  });

  return (
    <SettingRow
      label="Work (experimental)"
      rowKey="work"
      help={HELP}
      isChanged={save.value}
      onReset={() => void save.save({ value: false })}
      save={save}
    >
      <Switch
        ariaLabel="Work (experimental)"
        checked={save.value}
        onChange={(isOn) => void save.save({ value: isOn })}
      />
    </SettingRow>
  );
};
