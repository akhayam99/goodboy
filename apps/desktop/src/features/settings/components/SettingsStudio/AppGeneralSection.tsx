import { Band } from '@goodboy/ui';
import { ContrastPreferenceField } from './ContrastPreferenceField';
import { ThemePreferenceField } from './ThemePreferenceField';
import { OpenWithBand } from './OpenWithBand';
import { SearchIndexBand } from './SearchIndexBand';
import { RepoCheckBand } from './RepoCheckBand';
import { AwayAlertsBand } from './AwayAlertsBand';
import { TerminalExitStatusBand } from './TerminalExitStatusBand';
import { WorkSwitchField } from './WorkSwitchField';

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

    <TerminalExitStatusBand />

    <RepoCheckBand />

    <SearchIndexBand />

    <Band inset="content" label="Experiments" headingLevel={2}>
      <div className="flex flex-col">
        <WorkSwitchField />
      </div>
    </Band>
  </div>
);
