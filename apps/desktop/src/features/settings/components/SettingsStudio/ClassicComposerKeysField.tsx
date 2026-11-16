import { Switch } from '@goodboy/ui';
import { useComposerClassicKeys } from '../../../../shared/hooks/useComposerClassicKeys';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { NAMES } from '../../../../shared/utils/names';
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
      label={NAMES.classicSendKeys}
      rowKey="classic-send-keys"
      help={`${shortcutGlyphs('composer.send')} adds a line and ${shortcutGlyphs('composer.submit')} starts, as before 0.15.5.`}
      isChanged={save.value}
      onReset={() => void save.save({ value: false })}
      save={save}
    >
      <Switch
        ariaLabel={NAMES.classicSendKeys}
        checked={save.value}
        onChange={(isNext) => void save.save({ value: isNext })}
      />
    </SettingRow>
  );
};
