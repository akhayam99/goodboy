import { useEffect, useRef, useState } from 'react';
import { Band, FieldRow, Switch, appScrollIntoView } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { useInstalledVersion } from '../../../changelog/hooks/useInstalledVersion';
import { UpdateVersionRow } from '../../../updater/components/UpdateVersionRow';
import { SETTING_UPDATER_AUTO_DOWNLOAD } from '../../../settings/settings';
import { UpdatesWhatsNewRow } from './UpdatesWhatsNewRow';

type Props = {
  readonly isFocused?: boolean;
};

export const UpdatesSection = ({ isFocused = false }: Props) => {
  const loadSetting = useAppStore((state) => state.loadSetting);
  const saveSetting = useAppStore((state) => state.saveSetting);
  const installedVersion = useInstalledVersion();
  const [isAutoDownload, setIsAutoDownload] = useState(true);
  const bandRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadSetting(SETTING_UPDATER_AUTO_DOWNLOAD).then((value) =>
      setIsAutoDownload(value !== 'false'),
    );
  }, [loadSetting]);

  useEffect(() => {
    if (isFocused) {
      appScrollIntoView({ element: bandRef.current, block: 'start' });
    }
  }, [isFocused]);

  const onToggleAutoDownload = (next: boolean): void => {
    setIsAutoDownload(next);
    void saveSetting(SETTING_UPDATER_AUTO_DOWNLOAD, next ? 'true' : 'false');
  };

  return (
    <div ref={bandRef} className="flex flex-col">
      <Band inset="content" label="Updates" headingLevel={2}>
        <div className="flex flex-col">
          <UpdateVersionRow installedVersion={installedVersion} />
          <UpdatesWhatsNewRow />
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
    </div>
  );
};
