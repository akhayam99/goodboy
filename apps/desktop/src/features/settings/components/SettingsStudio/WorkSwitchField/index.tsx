import { FieldRow, Switch } from '@goodboy/ui';
import { useIsWorkOn } from '../../../../../shared/hooks/useIsWorkOn';
import { SETTING_WORK_ENABLED } from '../../../../../shared/lib/workSetting';
import { useAppSettingSave } from '../../../hooks/useAppSettingSave';
import { SWITCH_SETTING } from '../../../switchSetting';
import { SaveErrorHelp } from '../SaveErrorHelp';

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
    <FieldRow
      label="Work (experimental)"
      help={save.error === null ? HELP : <SaveErrorHelp help={HELP} save={save} />}
    >
      <Switch
        ariaLabel="Work (experimental)"
        checked={save.value}
        onChange={(isOn) => void save.save({ value: isOn })}
      />
    </FieldRow>
  );
};
