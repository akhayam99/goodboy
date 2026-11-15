import { useEffect } from 'react';
import { Band, FieldRow, Switch } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { useInstalledVersion } from '../../../changelog/hooks/useInstalledVersion';
import { UpdateVersionRow } from '../../../updater/components/UpdateVersionRow';
import { useAppSettingSave } from '../../hooks/useAppSettingSave';
import { SETTING_UPDATER_AUTO_DOWNLOAD } from '../../settings';
import { SWITCH_SETTING } from '../../switchSetting';
import { SaveErrorHelp } from './SaveErrorHelp';

const HELP = 'Restart to use a new version once it lands.';

export const UpdatesSection = () => {
  const loadSetting = useAppStore((state) => state.loadSetting);
  const stored = useAppStore((state) => state.settings[SETTING_UPDATER_AUTO_DOWNLOAD]);
  const installedVersion = useInstalledVersion();
  const save = useAppSettingSave({
    settingKey: SETTING_UPDATER_AUTO_DOWNLOAD,
    saved: stored !== 'false',
    ...SWITCH_SETTING,
    failureTitle: "Couldn't save background downloads",
  });

  useEffect(() => {
    void loadSetting(SETTING_UPDATER_AUTO_DOWNLOAD);
  }, [loadSetting]);

  return (
    <Band inset="content" label="Version" headingLevel={2}>
      <div className="flex flex-col">
        <UpdateVersionRow installedVersion={installedVersion} />
        <FieldRow
          label="Download updates in the background"
          help={save.error === null ? HELP : <SaveErrorHelp help={HELP} save={save} />}
        >
          <Switch
            ariaLabel="Download updates in the background"
            checked={save.value}
            onChange={(isNext) => void save.save({ value: isNext })}
          />
        </FieldRow>
      </div>
    </Band>
  );
};
