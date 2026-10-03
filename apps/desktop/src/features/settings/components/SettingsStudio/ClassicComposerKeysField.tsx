import { FieldRow, Switch } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { useComposerClassicKeys } from '../../../../shared/hooks/useComposerClassicKeys';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { SETTING_COMPOSER_CLASSIC_KEYS } from '../../settings';

export const ClassicComposerKeysField = () => {
  const isClassic = useComposerClassicKeys({ isEnabled: true });
  const saveSetting = useAppStore((state) => state.saveSetting);
  const reportError = useAppStore((state) => state.reportError);

  const onChange = async (next: boolean) => {
    try {
      await saveSetting(SETTING_COMPOSER_CLASSIC_KEYS, next ? 'true' : 'false');
    } catch (error) {
      void reportError({ title: "Couldn't save the composer keys", error });
    }
  };

  return (
    <FieldRow
      label="Classic keys when starting an agent"
      help={`${shortcutGlyphs('composer.send')} adds a line and ${shortcutGlyphs('composer.submit')} starts, as before 0.15.5. Other message boxes keep ${shortcutGlyphs('composer.send')} to send.`}
    >
      <Switch
        label={isClassic ? 'On' : 'Off'}
        checked={isClassic}
        onChange={(next) => void onChange(next)}
      />
    </FieldRow>
  );
};
