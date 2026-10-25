import { Band } from '@goodboy/ui';
import { ContrastPreferenceField } from './ContrastPreferenceField';
import { ThemePreferenceField } from './ThemePreferenceField';
import { OpenWithBand } from './OpenWithBand';
import { SearchIndexBand } from './SearchIndexBand';
import { RepoCheckBand } from './RepoCheckBand';
import { AwayAlertsBand } from './AwayAlertsBand';

export const AppGeneralSection = () => (
  <div className="flex flex-col gap-6">
    <Band inset="content" label="Appearance" headingLevel={2}>
      <div className="flex flex-col">
        <ThemePreferenceField />
        <ContrastPreferenceField />
      </div>
    </Band>

    <AwayAlertsBand />

    <OpenWithBand />

    <RepoCheckBand />

    <SearchIndexBand />
  </div>
);
