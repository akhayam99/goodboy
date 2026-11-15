import { FieldRow, Switch } from '@goodboy/ui';
import { useComposerClassicKeys } from '../../../../shared/hooks/useComposerClassicKeys';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { useAppSettingSave } from '../../hooks/useAppSettingSave';
import { SETTING_COMPOSER_CLASSIC_KEYS } from '../../settings';
import { SWITCH_SETTING } from '../../switchSetting';
import { SaveErrorHelp } from './SaveErrorHelp';

export const ClassicComposerKeysField = () => {
  const isClassic = useComposerClassicKeys({ isEnabled: true });
  const save = useAppSettingSave({
    settingKey: SETTING_COMPOSER_CLASSIC_KEYS,
    saved: isClassic,
    ...SWITCH_SETTING,
    failureTitle: "Couldn't save the composer keys",
  });
  const help = `Starting an agent adds a line on ${shortcutGlyphs('composer.send')} and starts on ${shortcutGlyphs('composer.submit')}, and review replies send on ${shortcutGlyphs('composer.send')}.`;

  return (
    <FieldRow
      label="Keys from before 0.15.5"
      help={save.error === null ? help : <SaveErrorHelp help={help} save={save} />}
    >
      <Switch
        ariaLabel="Keys from before 0.15.5"
        checked={save.value}
        onChange={(next) => void save.save({ value: next })}
      />
    </FieldRow>
  );
};
