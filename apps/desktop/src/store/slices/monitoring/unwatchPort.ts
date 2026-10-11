import { setSetting } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { projectById } from '../projects/projectIndex';
import { commitAfterConfirm } from '../state-writes/commitAfterConfirm';
import { enqueuePortWrite } from './enqueuePortWrite';
import { watchedPortsKey } from './settingKeys';
import type { GetFn, SetFn, WatchPortParams } from './types';

export const unwatchPort = (set: SetFn, get: GetFn) => {
  return ({ projectId, port }: WatchPortParams): Promise<void> =>
    enqueuePortWrite({
      task: async () => {
        const project = projectById(get().projects, projectId);
        const current = get().monitorWatched[projectId] ?? [];
        if (project === undefined || !current.includes(port)) {
          return;
        }
        const next = current.filter((candidate) => candidate !== port);
        await commitAfterConfirm({
          get,
          failureTitle: "Couldn't stop watching the port",
          target: { workspaceId: project.workspaceId },
          step: () =>
            setSetting(tauriDatabase, watchedPortsKey({ projectId }), JSON.stringify(next)),
          commit: () =>
            set((state) => ({ monitorWatched: { ...state.monitorWatched, [projectId]: next } })),
        });
      },
    });
};
