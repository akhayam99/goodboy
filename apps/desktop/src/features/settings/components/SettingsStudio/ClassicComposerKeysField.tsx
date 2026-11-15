import { Switch } from '@goodboy/ui';
import { useComposerClassicKeys } from '../../../../shared/hooks/useComposerClassicKeys';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { useAppSettingSave } from '../../hooks/useAppSettingSave';
import { SETTING_COMPOSER_CLASSIC_KEYS } from '../../settings';
import { SWITCH_SETTING } from '../../switchSetting';
import { SettingRow } from './SettingRow';

export const ClassicComposerKeysField = () => {
  const isClassic = useComposerClassicKeys({ isEnabled: true });
  const save = useAppSettingSave({
    settingKey: SETTING_COMPOSER_CLASSIC_KEYS,
    saved: isClassic,
    ...SWITCH_SETTING,
    failureTitle: "Couldn't save the composer keys",
  });

  return (
    <SettingRow
      label="Keys from before 0.15.5"
      rowKey="classic-send-keys"
      help={`Starting an agent adds a line on ${shortcutGlyphs('composer.send')} and starts on ${shortcutGlyphs('composer.submit')}, and review replies send on ${shortcutGlyphs('composer.send')}.`}
      isChanged={save.value}
      onReset={() => void save.save({ value: false })}
      save={save}
    >
      <Switch
        ariaLabel="Keys from before 0.15.5"
        checked={save.value}
        onChange={(isNext) => void save.save({ value: isNext })}
      />
    </SettingRow>
  );
};
