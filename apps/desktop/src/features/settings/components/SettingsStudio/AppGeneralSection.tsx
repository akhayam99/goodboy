import { Band } from '@goodboy/ui';
import { ThemePreferenceField } from './ThemePreferenceField';
import { OpenWithBand } from './OpenWithBand';
import { TerminalShellBand } from './TerminalShellBand';
import { SearchIndexBand } from './SearchIndexBand';
import { RepoCheckBand } from './RepoCheckBand';

export const AppGeneralSection = () => (
  <div className="flex flex-col gap-6">
    <Band inset="content" label="Appearance" headingLevel={2}>
      <div className="flex flex-col">
        <ThemePreferenceField />
      </div>
    </Band>

    <OpenWithBand />

    <TerminalShellBand />

    <RepoCheckBand />

    <SearchIndexBand />
  </div>
);
