import type { ProjectId, Session } from '@goodboy/types';
import type { GetFn, SetFn } from '../../slice-types';
import { projectById } from '../projects/projectIndex';
import { sessionById } from '../sessions/sessionIndex';

const FIRST_LAP_TITLE = 'First lap';

type Input = {
  readonly projectId: ProjectId;
};

export const ensureFirstLapSession = (_set: SetFn, get: GetFn) => {
  return async ({ projectId }: Input): Promise<Session> => {
    const project = projectById(get().projects, projectId);
    if (project === undefined) {
      throw new Error(`project not found: ${projectId}`);
    }
    const phase = get().bootstrapPhase[projectId];
    if (phase === undefined || phase.stage !== 'first-lap') {
      throw new Error('this project is not in its first lap');
    }
    const existingId = phase.firstLapSessionId;
    const existing = existingId === null ? undefined : sessionById(get().sessions, existingId);
    if (existing !== undefined) {
      return existing;
    }
    const { session } = await get().createSession({
      workspaceId: project.workspaceId,
      goal: '',
      title: FIRST_LAP_TITLE,
      omitGoalSlot: true,
    });
    await get().setBootstrapPhase({ projectId, patch: { firstLapSessionId: session.id } });
    return session;
  };
};
