import { Band } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { UpdatesSection } from './UpdatesSection';
import { ThemePreferenceField } from './ThemePreferenceField';
import { LegacyLayoutField } from './LegacyLayoutField';
import { OpenWithBand } from './OpenWithBand';
import { SearchIndexBand } from './SearchIndexBand';

export const AppGeneralSection = () => {
  return (
    <div className="flex flex-col gap-4">
      <UpdatesSection />

      <Band
        inset="content"
        label="Appearance"
        hint="How the app looks on this computer."
        icon={<CONCEPT_ICONS.appearance size={ICON_SIZE.row} aria-hidden />}
        headingLevel={2}
      >
        <div className="flex flex-col">
          <ThemePreferenceField />
          <LegacyLayoutField />
        </div>
      </Band>

      <OpenWithBand />

      <SearchIndexBand />
    </div>
  );
};
