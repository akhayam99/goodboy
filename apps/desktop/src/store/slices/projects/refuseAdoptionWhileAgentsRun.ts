import type { Project } from '@goodboy/types';
import {
  countRunningAdoptionAgents,
  getWorkspaceById,
  type ProjectAdoptionInfo,
} from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { pluralize } from '../../../shared/utils/pluralize';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly project: Project;
  readonly info: ProjectAdoptionInfo;
};

export const refuseAdoptionWhileAgentsRun = async ({
  get,
  project,
  info,
}: Params): Promise<void> => {
  const running = await countRunningAdoptionAgents({
    db: tauriDatabase,
    projectId: project.id,
    info,
  });
  if (running === 0) {
    return;
  }
  const source =
    get().workspaces.find((workspace) => workspace.id === info.sourceWorkspaceId) ??
    (await getWorkspaceById({ db: tauriDatabase, id: info.sourceWorkspaceId }));
  const where = source === null || source === undefined ? 'another workspace' : source.name;
  const verb = running === 1 ? 'is' : 'are';
  throw new Error(
    `${project.name} was not moved: ${pluralize(running, 'agent')} ${verb} running in ${where}. Stop them, then try again.`,
  );
};
