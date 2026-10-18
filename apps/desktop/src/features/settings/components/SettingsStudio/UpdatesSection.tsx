import { useEffect, useState } from 'react';
import { Band, FieldRow, Switch } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { useInstalledVersion } from '../../../changelog/hooks/useInstalledVersion';
import { UpdateVersionRow } from '../../../updater/components/UpdateVersionRow';
import { SETTING_UPDATER_AUTO_DOWNLOAD } from '../../../settings/settings';

export const UpdatesSection = () => {
  const loadSetting = useAppStore((state) => state.loadSetting);
  const saveSetting = useAppStore((state) => state.saveSetting);
  const installedVersion = useInstalledVersion();
  const [isAutoDownload, setIsAutoDownload] = useState(true);

  useEffect(() => {
    void loadSetting(SETTING_UPDATER_AUTO_DOWNLOAD).then((value) =>
      setIsAutoDownload(value !== 'false'),
    );
  }, [loadSetting]);

  const onToggleAutoDownload = (next: boolean): void => {
    setIsAutoDownload(next);
    void saveSetting(SETTING_UPDATER_AUTO_DOWNLOAD, next ? 'true' : 'false');
  };

  return (
    <Band inset="content" label="Version" headingLevel={2}>
      <div className="flex flex-col">
        <UpdateVersionRow installedVersion={installedVersion} />
        <FieldRow
          label="Download updates in the background"
          help="Restart to use a new version once it lands."
        >
          <Switch
            ariaLabel="Download updates in the background"
            checked={isAutoDownload}
            onChange={onToggleAutoDownload}
          />
        </FieldRow>
      </div>
    </Band>
  );
};
