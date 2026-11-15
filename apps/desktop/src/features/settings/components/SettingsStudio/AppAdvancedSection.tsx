import { Band } from '@goodboy/ui';
import { RepoCheckBand } from './RepoCheckBand';
import { SearchIndexBand } from './SearchIndexBand';
import { TerminalExitStatusBand } from './TerminalExitStatusBand';
import { WorkSwitchField } from './WorkSwitchField';

export const AppAdvancedSection = () => (
  <div className="flex flex-col gap-6">
    <RepoCheckBand />

    <TerminalExitStatusBand />

    <SearchIndexBand />

    <Band inset="content" label="Experiments" headingLevel={2}>
      <div className="flex flex-col">
        <WorkSwitchField />
      </div>
    </Band>
  </div>
);
