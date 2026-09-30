import type {
  EffortLevel,
  ModelKey,
  ProjectId,
  ProviderId,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import type { AppStore } from '../../store/store';
import { workPromptOf, type WorkBrief } from './workBrief';

type WorkTarget =
  | { readonly kind: 'new'; readonly projectIds: ReadonlyArray<ProjectId> }
  | { readonly kind: 'add'; readonly sessionId: SessionId };

export type WorkRouting = {
  readonly provider: ProviderId;
  readonly model: ModelKey;
  readonly effort: EffortLevel;
};

export type StartedWork = {
  readonly sessionId: SessionId;
  readonly draft: string | null;
};

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly brief: WorkBrief;
  readonly target: WorkTarget;
  readonly routing: WorkRouting | null;
  readonly createSession: AppStore['createSession'];
  readonly setSessionConfig: AppStore['setSessionConfig'];
};

export const startWorkFromChat = async ({
  workspaceId,
  brief,
  target,
  routing,
  createSession,
  setSessionConfig,
}: Params): Promise<StartedWork> => {
  const prompt = workPromptOf({ brief });
  if (target.kind === 'add') {
    return { sessionId: target.sessionId, draft: `${brief.title}\n\n${prompt}` };
  }
  const [primaryProjectId, ...additionalProjectIds] = target.projectIds;
  const { session } = await createSession({
    workspaceId,
    goal: prompt,
    title: brief.title,
    ...(primaryProjectId !== undefined && { projectId: primaryProjectId }),
    ...(additionalProjectIds.length > 0 && { additionalProjectIds }),
  });
  if (routing !== null) {
    await setSessionConfig(session.id, {
      providerOverride: routing.provider,
      modelOverride: routing.model,
      effort: routing.effort,
    });
  }
  return { sessionId: session.id, draft: null };
};
