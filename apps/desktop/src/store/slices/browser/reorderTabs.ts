import { CommandError } from '../../../shared/lib/invokeCommand';
import { browserTabCommands } from './browserTabCommands';
import { browserWrite } from './browserWrite';
import { browserWrites } from './browserWrites';
import type { SliceDeps } from '../../slice-types';
import type { ReorderTabsParams } from './types';

const TAB_ROWS_CHANGED = 'tab-rows-changed';

export const reorderTabs = ({ set, get }: SliceDeps) => {
  return ({ sessionId, ids }: ReorderTabsParams): Promise<boolean> =>
    browserWrite({
      get,
      failureTitle: "Couldn't reorder the tabs",
      target: { sessionId },
      step: () => browserTabCommands.reorder({ owner: { kind: 'session', sessionId }, ids }),
      commit: ({ value: tabs }) => {
        browserWrites.loads.cancel({ key: browserWrites.sessionLoadKey({ sessionId }) });
        set((state) => ({
          browserSessionTabs: { ...state.browserSessionTabs, [sessionId]: tabs },
        }));
      },
      onFailure: ({ error }) => {
        if (error instanceof CommandError && error.message === TAB_ROWS_CHANGED) {
          void get().loadBrowserSessionTabs({ sessionId });
        }
      },
    });
};
