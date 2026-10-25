import { Band, Button, FieldRow } from '@goodboy/ui';
import { APP_VERSION } from '../../../../shared/lib/appVersion';
import { NAMES } from '../../../../shared/utils/names';
import { openChangelogStudio } from '../../../changelog/changelogStudioEvent';
import { CHANGELOG_RELEASES } from '../../../changelog/changelogSource';
import { isInstalledRelease } from '../../../changelog/isInstalledRelease';
import { releaseSummary } from '../../../changelog/releaseSummary';

const FALLBACK_HELP = 'What changed in each version, newest first.';

export const UpdatesWhatsNewBand = () => {
  const release = CHANGELOG_RELEASES.find((entry) =>
    isInstalledRelease({ tag: entry.version, installed: APP_VERSION }),
  );
  const summary = release === undefined ? '' : releaseSummary({ release });

  return (
    <Band inset="content" label={NAMES.whatsNew} headingLevel={2}>
      <FieldRow
        label={release === undefined ? 'Release notes' : release.version}
        help={summary === '' ? FALLBACK_HELP : summary}
      >
        <Button variant="ghost" size="sm" onClick={openChangelogStudio}>
          {`Open ${NAMES.whatsNew}`}
        </Button>
      </FieldRow>
    </Band>
  );
};
