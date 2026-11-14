import { tauriDatabase } from '../../../shared/lib/db';
import { createLatestOnly } from '../../runtime/state-writes/latestOnly';
import type { SliceDeps } from '../../slice-types';
import { readWorkLeads } from './readWorkLeads';
import { workInitialState } from './state';
import type { WorkSlice } from './types';

const READ_KEY = 'work-leads';

export const createWorkSlice = ({ set }: SliceDeps): WorkSlice => {
  const latest = createLatestOnly();
  return {
    ...workInitialState,
    loadWorkLeads: async ({ workspaceId, filter }) => {
      const claim = latest.claim({ key: READ_KEY });
      try {
        const leads = await readWorkLeads({ db: tauriDatabase, workspaceId });
        if (!claim.isCurrent()) {
          return;
        }
        set({
          workLeads: leads,
          workFilter: filter,
          workWorkspaceId: workspaceId,
          isWorkStale: false,
        });
      } catch {
        if (!claim.isCurrent()) {
          return;
        }
        set((state) => ({
          workFilter: filter,
          workWorkspaceId: workspaceId,
          isWorkStale: true,
          workLeads: state.workWorkspaceId === workspaceId ? state.workLeads : [],
        }));
      }
    },
  };
};
