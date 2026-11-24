import { OpenWithBand } from './OpenWithBand';
import { RepoCheckBand } from './RepoCheckBand';
import { TerminalExitStatusBand } from './TerminalExitStatusBand';

export const AppDevToolsSection = () => (
  <div className="flex flex-col gap-6">
    <OpenWithBand />

    <TerminalExitStatusBand />

    <RepoCheckBand />
  </div>
);
