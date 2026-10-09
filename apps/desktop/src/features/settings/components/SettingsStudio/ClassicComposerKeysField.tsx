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
      label="Keys from before 0.15.5"
      help={`Starting an agent adds a line on ${shortcutGlyphs('composer.send')} and starts on ${shortcutGlyphs('composer.submit')}, and review replies send on ${shortcutGlyphs('composer.send')}.`}
    >
      <Switch
        ariaLabel="Keys from before 0.15.5"
        checked={isClassic}
        onChange={(next) => void onChange(next)}
      />
    </FieldRow>
  );
};
