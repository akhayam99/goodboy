import { FieldRow, Switch } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { useClassicBars } from '../../../../shared/hooks/useClassicBars';
import { SETTING_SHELL_CLASSIC_BARS } from '../../settings';

export const ClassicBarsField = () => {
  const isClassic = useClassicBars();
  const saveSetting = useAppStore((state) => state.saveSetting);
  const reportError = useAppStore((state) => state.reportError);

  const onChange = async (next: boolean) => {
    try {
      await saveSetting(SETTING_SHELL_CLASSIC_BARS, next ? 'true' : 'false');
    } catch (error) {
      void reportError({ title: "Couldn't switch the bars", error });
    }
  };

  return (
    <FieldRow
      label="Classic bars"
      help="Board and Chat up top, the rest in a footer, as in 0.20.0."
    >
      <Switch
        label={isClassic ? 'On' : 'Off'}
        checked={isClassic}
        onChange={(next) => void onChange(next)}
      />
    </FieldRow>
  );
};
