import { useEffect, useRef } from 'react';
import { Band, Switch, appScrollIntoView } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { useInstalledVersion } from '../../../changelog/hooks/useInstalledVersion';
import { UpdateVersionRow } from '../../../updater/components/UpdateVersionRow';
import { useAppSettingSave } from '../../hooks/useAppSettingSave';
import { SETTING_UPDATER_AUTO_DOWNLOAD } from '../../settings';
import { SWITCH_SETTING } from '../../switchSetting';
import { SettingRow } from './SettingRow';
import { UpdatesWhatsNewRow } from './UpdatesWhatsNewRow';

type Props = {
  readonly isFocused?: boolean;
};

export const UpdatesSection = ({ isFocused = false }: Props) => {
  const loadSetting = useAppStore((state) => state.loadSetting);
  const stored = useAppStore((state) => state.settings[SETTING_UPDATER_AUTO_DOWNLOAD]);
  const installedVersion = useInstalledVersion();
  const bandRef = useRef<HTMLDivElement>(null);
  const save = useAppSettingSave({
    settingKey: SETTING_UPDATER_AUTO_DOWNLOAD,
    saved: stored !== 'false',
    ...SWITCH_SETTING,
    failureTitle: "Couldn't save background downloads",
  });

  useEffect(() => {
    void loadSetting(SETTING_UPDATER_AUTO_DOWNLOAD);
  }, [loadSetting]);

  useEffect(() => {
    if (isFocused) {
      appScrollIntoView({ element: bandRef.current, block: 'start' });
    }
  }, [isFocused]);

  return (
    <div ref={bandRef} className="flex flex-col">
      <Band inset="content" label="Updates" headingLevel={2}>
        <div className="flex flex-col">
          <UpdateVersionRow installedVersion={installedVersion} />
          <UpdatesWhatsNewRow />
          <SettingRow
            label="Download updates in the background"
            rowKey="background-download"
            help="Restart to use a new version once it lands."
            isChanged={!save.value}
            onReset={() => void save.save({ value: true })}
            save={save}
          >
            <Switch
              ariaLabel="Download updates in the background"
              checked={save.value}
              onChange={(isNext) => void save.save({ value: isNext })}
            />
          </SettingRow>
        </div>
      </Band>
    </div>
  );
};
