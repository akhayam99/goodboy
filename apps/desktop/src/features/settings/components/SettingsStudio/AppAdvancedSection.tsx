import { RepoCheckBand } from './RepoCheckBand';
import { SearchIndexBand } from './SearchIndexBand';
import { TerminalExitStatusBand } from './TerminalExitStatusBand';

export const AppAdvancedSection = () => (
  <div className="flex flex-col gap-6">
    <RepoCheckBand />

    <TerminalExitStatusBand />

    <SearchIndexBand />
  </div>
);
