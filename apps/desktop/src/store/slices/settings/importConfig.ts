import type { ConfigBundleImportResult } from '@goodboy/types';
import { listProjectsForWorkspace, listWorkspaces } from '@goodboy/db';
import { importConfigFromFile } from '../../../features/settings/config-export';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

export const importConfig = (set: SetFn, get: GetFn) => {
  return async (): Promise<ConfigBundleImportResult | null> => {
    const result = await importConfigFromFile();
    if (result?.ok !== true) {
      return result;
    }
    const workspaces = await listWorkspaces({ db: tauriDatabase });
    const projects = (
      await Promise.all(
        workspaces.map((workspace) =>
          listProjectsForWorkspace({ db: tauriDatabase, workspaceId: workspace.id }),
        ),
      )
    ).flat();
    set({ workspaces, projects });
    await Promise.all(
      workspaces.flatMap((workspace) => [
        get()
          .loadPhaseTemplates(workspace.id)
          .catch(() => undefined),
        get()
          .rescanSkills(workspace.id)
          .catch(() => undefined),
      ]),
    );
    return result;
  };
};
