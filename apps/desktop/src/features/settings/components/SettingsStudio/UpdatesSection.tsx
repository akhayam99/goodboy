import { useEffect, useState } from 'react';
import { Button, FieldRow, SectionSurface, Switch } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { useInstalledVersion } from '../../../changelog/hooks/useInstalledVersion';
import { UpdateConfirm } from '../../../updater/components/UpdateConfirm';
import { formatRelativeDuration } from '../../../../shared/utils/relativeDate';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { SETTING_UPDATER_AUTO_DOWNLOAD } from '../../../settings/settings';
import type { UpdateFailure } from '../../../../store/slices/updater/state';

const TICK_MS = 30_000;

type CheckedLineParams = {
  readonly installedVersion: string | null;
  readonly checkedAt: string | null;
  readonly now: number;
};

export const checkedLine = ({ installedVersion, checkedAt, now }: CheckedLineParams): string => {
  const name = installedVersion === null ? 'Goodboy' : `Goodboy ${installedVersion}`;
  if (checkedAt === null) {
    return `${name}, not checked yet`;
  }
  const ago = formatRelativeDuration(checkedAt, new Date(now).toISOString());
  return `${name}, checked ${ago} ago`;
};

const failureLine = ({ failure, target }: { failure: UpdateFailure; target: string }): string => {
  if (failure.phase === 'check') {
    return `Couldn't check for updates: ${failure.message}`;
  }
  return `Couldn't install ${target}: ${failure.message}`;
};

const useNow = (): number => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(timer);
  }, []);
  return now;
};

export const UpdatesSection = () => {
  const status = useAppStore((state) => state.updaterStatus);
  const version = useAppStore((state) => state.updateVersion);
  const failure = useAppStore((state) => state.updateFailure);
  const checkedAt = useAppStore((state) => state.updateCheckedAt);
  const checkForUpdates = useAppStore((state) => state.checkForUpdates);
  const loadSetting = useAppStore((state) => state.loadSetting);
  const saveSetting = useAppStore((state) => state.saveSetting);
  const installedVersion = useInstalledVersion();
  const now = useNow();
  const isChecking = status === 'checking';
  const isAvailable = status === 'available';
  const isDownloading = status === 'downloading';
  const target = version ?? 'the new version';
  const [autoDownload, setAutoDownload] = useState(true);

  useEffect(() => {
    void loadSetting(SETTING_UPDATER_AUTO_DOWNLOAD).then((value) =>
      setAutoDownload(value !== 'false'),
    );
  }, [loadSetting]);

  const onToggleAutoDownload = (next: boolean): void => {
    setAutoDownload(next);
    void saveSetting(SETTING_UPDATER_AUTO_DOWNLOAD, next ? 'true' : 'false');
  };

  return (
    <SectionSurface
      label="Updates"
      hint="Goodboy looks for a new version every hour."
      icon={<CONCEPT_ICONS.updates size={ICON_SIZE.row} aria-hidden />}
      headingLevel={2}
    >
      <div className="flex flex-col">
        <FieldRow label="Version" help={checkedLine({ installedVersion, checkedAt, now })}>
          <span className="flex items-center gap-2">
            {isAvailable && (
              <UpdateConfirm
                trigger={({ arm }) => (
                  <Button variant="primary" size="sm" onClick={arm}>
                    {failure?.phase === 'install' ? 'Retry update' : `Update to ${target}`}
                  </Button>
                )}
              />
            )}
            {isDownloading && (
              <Button variant="secondary" size="sm" disabled>
                Downloading
              </Button>
            )}
            {!isAvailable && !isDownloading && (
              <Button
                variant="secondary"
                size="sm"
                isBusy={isChecking}
                busyLabel="Checking"
                onClick={() => void checkForUpdates()}
              >
                Check now
              </Button>
            )}
          </span>
        </FieldRow>
        {failure !== null && (
          <p role="status" className="text-xs text-danger">
            {failureLine({ failure, target })}
          </p>
        )}
        <FieldRow
          label="Download updates in the background"
          help="Restart to use it once it lands."
        >
          <Switch
            label={autoDownload ? 'On' : 'Off'}
            checked={autoDownload}
            onChange={onToggleAutoDownload}
          />
        </FieldRow>
      </div>
    </SectionSurface>
  );
};
