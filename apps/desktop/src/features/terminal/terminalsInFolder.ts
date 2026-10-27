import type { MountId } from '@goodboy/types';
import type { TerminalTab } from '../../shared/types/terminal';
import { trimTrailingSeparators } from '../../store/slices/terminal/terminalOwner';

type Params = {
  readonly tabs: Readonly<Record<string, ReadonlyArray<TerminalTab>>>;
  readonly path: string;
  readonly mountId: MountId | null;
};

export const terminalsInFolder = ({ tabs, path, mountId }: Params): ReadonlyArray<TerminalTab> => {
  const root = trimTrailingSeparators({ path });
  return Object.values(tabs)
    .flat()
    .filter((tab) => {
      if (tab.status === 'exited') {
        return false;
      }
      if (mountId !== null && tab.mountId === mountId) {
        return true;
      }
      return (
        tab.cwd !== null && root !== '' && (tab.cwd === root || tab.cwd.startsWith(`${root}/`))
      );
    });
};
