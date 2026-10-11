import { setSetting } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { projectById } from '../projects/projectIndex';
import { commitAfterConfirm } from '../state-writes/commitAfterConfirm';
import { enqueuePortWrite } from './enqueuePortWrite';
import { isValidPort } from './isValidPort';
import { watchedPortsKey } from './settingKeys';
import type { GetFn, SetFn, WatchPortParams } from './types';

export const watchPort = (set: SetFn, get: GetFn) => {
  return ({ projectId, port }: WatchPortParams): Promise<void> =>
    enqueuePortWrite({
      task: async () => {
        const project = projectById(get().projects, projectId);
        if (project === undefined || !isValidPort({ port })) {
          return;
        }
        const current = get().monitorWatched[projectId] ?? [];
        if (current.includes(port)) {
          return;
        }
        const next = [...current, port].sort((a, b) => a - b);
        await commitAfterConfirm({
          get,
          failureTitle: "Couldn't watch the port",
          target: { workspaceId: project.workspaceId },
          step: () =>
            setSetting(tauriDatabase, watchedPortsKey({ projectId }), JSON.stringify(next)),
          commit: () =>
            set((state) => ({ monitorWatched: { ...state.monitorWatched, [projectId]: next } })),
        });
      },
    });
};
