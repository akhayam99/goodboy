import { FieldRow, Switch } from '@goodboy/ui';
import { NAMES } from '../../../../shared/names';
import { useAppStore } from '../../../../store';
import { useClassicBars } from '../../../../shared/hooks/useClassicBars';
import { SETTING_SHELL_CLASSIC_BARS } from '../../settings';

export const LegacyLayoutField = () => {
  const isLegacy = useClassicBars();
  const saveSetting = useAppStore((state) => state.saveSetting);
  const reportError = useAppStore((state) => state.reportError);

  const onChange = async (next: boolean) => {
    try {
      await saveSetting(SETTING_SHELL_CLASSIC_BARS, next ? 'true' : 'false');
    } catch (error) {
      void reportError({ title: "Couldn't switch the layout", error });
    }
  };

  return (
    <FieldRow
      label={NAMES.legacyLayout}
      help={
        <>
          Board and Chat in the top bar and the other doors in a footer, as in 0.20. It may be
          removed in a future version.
        </>
      }
    >
      <Switch
        label={
          <>
            <span className="sr-only">{NAMES.legacyLayout}</span>
            <span aria-hidden>{isLegacy ? 'On' : 'Off'}</span>
          </>
        }
        checked={isLegacy}
        onChange={(next) => void onChange(next)}
      />
    </FieldRow>
  );
};
