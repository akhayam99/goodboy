import { FieldRow, Switch } from '@goodboy/ui';
import { switchContrast, useContrastStore } from '../../../../shared/lib/contrast';

export const ContrastPreferenceField = () => {
  const isOn = useContrastStore((state) => state.isSwitchOn);

  return (
    <FieldRow
      label="More contrast"
      help="Stronger borders and quiet text. Follows your system setting too."
    >
      <Switch
        ariaLabel="More contrast"
        checked={isOn}
        onChange={(isNext) => switchContrast({ isOn: isNext })}
      />
    </FieldRow>
  );
};
