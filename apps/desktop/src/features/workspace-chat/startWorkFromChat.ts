import type { ProjectId, SessionId, WorkspaceId } from '@goodboy/types';
import type { AppStore } from '../../store/store';
import { workPromptOf, type WorkBrief } from './workBrief';

type WorkTarget =
  | { readonly kind: 'new'; readonly projectIds: ReadonlyArray<ProjectId> }
  | { readonly kind: 'add'; readonly sessionId: SessionId };

export type StartedWork = {
  readonly sessionId: SessionId;
  readonly ask: string;
};

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly brief: WorkBrief;
  readonly target: WorkTarget;
  readonly createSession: AppStore['createSession'];
};

export const startWorkFromChat = async ({
  workspaceId,
  brief,
  target,
  createSession,
}: Params): Promise<StartedWork> => {
  const prompt = workPromptOf({ brief });
  if (target.kind === 'add') {
    return { sessionId: target.sessionId, ask: `${brief.title}\n\n${prompt}` };
  }
  const [primaryProjectId, ...additionalProjectIds] = target.projectIds;
  const { session } = await createSession({
    workspaceId,
    goal: prompt,
    title: brief.title,
    ...(primaryProjectId !== undefined && { projectId: primaryProjectId }),
    ...(additionalProjectIds.length > 0 && { additionalProjectIds }),
  });
  return { sessionId: session.id, ask: prompt };
};
