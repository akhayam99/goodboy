import type { ProjectId, SessionId, WorkspaceId } from '@goodboy/types';
import type { AppStore } from '../../store/store';
import { workPromptOf, type WorkBrief } from './workBrief';

type WorkTarget =
  | { readonly kind: 'new'; readonly projectIds: ReadonlyArray<ProjectId> }
  | { readonly kind: 'add'; readonly sessionId: SessionId };

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly brief: WorkBrief;
  readonly target: WorkTarget;
  readonly createSession: AppStore['createSession'];
  readonly sendTurn: AppStore['sendTurn'];
};

export const startWorkFromChat = async ({
  workspaceId,
  brief,
  target,
  createSession,
  sendTurn,
}: Params): Promise<SessionId> => {
  const prompt = workPromptOf({ brief });
  if (target.kind === 'add') {
    await sendTurn({ sessionId: target.sessionId, content: `${brief.title}\n\n${prompt}` });
    return target.sessionId;
  }
  const [primaryProjectId, ...additionalProjectIds] = target.projectIds;
  const { session } = await createSession({
    workspaceId,
    goal: brief.goal,
    title: brief.title,
    firstAgentKind: 'generic',
    kickoffPrompt: prompt,
    ...(primaryProjectId !== undefined && { projectId: primaryProjectId }),
    ...(additionalProjectIds.length > 0 && { additionalProjectIds }),
  });
  return session.id;
};
