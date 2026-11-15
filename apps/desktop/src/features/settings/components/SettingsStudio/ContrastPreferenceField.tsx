import { Switch } from '@goodboy/ui';
import { switchContrast, useContrastStore } from '../../../../shared/lib/contrast';
import { SettingRow } from './SettingRow';

export const ContrastPreferenceField = () => {
  const isOn = useContrastStore((state) => state.isSwitchOn);

  return (
    <SettingRow
      label="More contrast"
      rowKey="contrast"
      help="Stronger borders and quiet text. Follows your system setting too."
      isChanged={isOn}
      onReset={() => switchContrast({ isOn: false })}
    >
      <Switch
        ariaLabel="More contrast"
        checked={isOn}
        onChange={(isNext) => switchContrast({ isOn: isNext })}
      />
    </SettingRow>
  );
};
