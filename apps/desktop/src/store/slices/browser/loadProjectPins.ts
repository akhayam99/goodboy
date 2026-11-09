import { CHECK_STATE } from '../notifications/errorRecovery';
import { browserTabCommands } from './browserTabCommands';
import { browserWrites } from './browserWrites';
import { projectReportTarget } from './projectReportTarget';
import type { SliceDeps } from '../../slice-types';
import type { ProjectParams } from './types';

export const loadProjectPins = ({ set, get }: SliceDeps) => {
  return async ({ projectId }: ProjectParams): Promise<void> => {
    const claimed = browserWrites.loads.claim({
      key: browserWrites.projectLoadKey({ projectId }),
    });
    try {
      const pins = await browserTabCommands.list({ owner: { kind: 'project', projectId } });
      if (!claimed.isCurrent()) {
        return;
      }
      set((state) => ({
        browserProjectPins: { ...state.browserProjectPins, [projectId]: pins },
      }));
    } catch (error) {
      if (!claimed.isCurrent()) {
        return;
      }
      await get().reportError({
        recovery: CHECK_STATE,
        title: "Couldn't load the pinned tabs",
        error,
        ...projectReportTarget({ get, projectId }),
      });
    }
  };
};
