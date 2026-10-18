import { Band, Button, FieldRow } from '@goodboy/ui';
import { NAMES } from '../../../../shared/names';
import { openChangelogStudio } from '../../../changelog/changelogStudioEvent';

export const UpdatesWhatsNewBand = () => (
  <Band inset="content" label={NAMES.whatsNew} headingLevel={2}>
    <FieldRow label="Release notes" help="What changed in each version, newest first.">
      <Button variant="ghost" size="sm" onClick={openChangelogStudio}>
        {`Open ${NAMES.whatsNew}`}
      </Button>
    </FieldRow>
  </Band>
);
