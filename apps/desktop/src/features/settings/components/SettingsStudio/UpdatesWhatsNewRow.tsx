import { Button } from '@goodboy/ui';
import { APP_VERSION } from '../../../../shared/lib/appVersion';
import { NAMES } from '../../../../shared/utils/names';
import { openChangelogStudio } from '../../../changelog/changelogStudioEvent';
import { useAppStore } from '../../../../store';
import { isInstalledRelease } from '../../../changelog/isInstalledRelease';
import { releaseSummary } from '../../../changelog/releaseSummary';
import { SettingRow } from './SettingRow';

const FALLBACK_HELP = 'What changed in each version, newest first.';

export const UpdatesWhatsNewRow = () => {
  const releases = useAppStore((state) => state.changelogReleases);
  const release = releases.find((entry) =>
    isInstalledRelease({ tag: entry.version, installed: APP_VERSION }),
  );
  const summary = release === undefined ? '' : releaseSummary({ release });

  return (
    <SettingRow label={NAMES.whatsNew} help={summary === '' ? FALLBACK_HELP : summary}>
      <Button variant="ghost" size="sm" onClick={openChangelogStudio}>
        {`Open ${NAMES.whatsNew}`}
      </Button>
    </SettingRow>
  );
};
