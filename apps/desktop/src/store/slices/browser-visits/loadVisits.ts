import { invokeCommand } from '../../../shared/lib/invokeCommand';
import { CHECK_STATE } from '../notifications/errorRecovery';
import type { SliceDeps } from '../../slice-types';
import { browserVisitWrites } from './browserVisitWrites';
import { sameVisits } from './sameVisits';
import type { BrowserVisit, LoadVisitsParams } from './types';

const NO_VISITS: ReadonlyArray<BrowserVisit> = [];

export const loadVisits = ({ set, get }: SliceDeps) => {
  return async ({ sessionId }: LoadVisitsParams): Promise<void> => {
    const claimed = browserVisitWrites.loads.claim({
      key: browserVisitWrites.loadKey({ sessionId }),
    });
    try {
      const visits = await invokeCommand<ReadonlyArray<BrowserVisit>>('browser_visits_list', {
        args: { sessionId },
      });
      if (!claimed.isCurrent()) {
        return;
      }
      const before = get().browserVisits[sessionId] ?? NO_VISITS;
      if (sameVisits({ before, after: visits })) {
        return;
      }
      set((state) => ({ browserVisits: { ...state.browserVisits, [sessionId]: visits } }));
    } catch (error) {
      if (!claimed.isCurrent()) {
        return;
      }
      await get().reportError({
        recovery: CHECK_STATE,
        title: "Couldn't load the visited pages",
        error,
        sessionId,
      });
    }
  };
};
