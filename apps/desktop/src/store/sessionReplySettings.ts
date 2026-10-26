import type { MountId, ProjectId, SessionId } from '@goodboy/types';
import { replySettingsOf, type ReplySettings } from '../features/resolve/replySettings';
import type { ResolveStartStyle } from '../features/resolve/startResolve';
import { isAttributionEnabled } from '../shared/utils/attribution';
import { resolveSessionRepo } from './slices/worktrees/resolveSessionRepo';
import type { AppState } from './types';
import { sessionById } from './slices/sessions/sessionIndex';
import { projectById } from './slices/projects/projectIndex';

type Params = {
  readonly state: AppState;
  readonly sessionId: SessionId;
};

type SettingsParams = Params & { readonly projectId?: ProjectId | null };

export const sessionReplySettings = ({
  state,
  sessionId,
  projectId: named,
}: SettingsParams): ReplySettings => {
  const session = sessionById(state.sessions, sessionId);
  const projectId = named ?? state.sessionActiveProject?.[sessionId] ?? null;
  const project = projectById(state.projects, projectId);
  const workspace =
    session === undefined ? null : (state.workspaceOverrides?.[session.workspaceId] ?? null);
  return {
    ...replySettingsOf({ layers: [project?.overrides, workspace] }),
    isSigned: isAttributionEnabled({ overrides: workspace }),
  };
};

type StyleParams = Params & { readonly mountId?: MountId };

export const sessionResolveStyle = ({
  state,
  sessionId,
  mountId,
}: StyleParams): ResolveStartStyle => {
  const repo = resolveSessionRepo({ state, sessionId, ...(mountId !== undefined && { mountId }) });
  const settings = sessionReplySettings({
    state,
    sessionId,
    ...(mountId !== undefined && { projectId: repo?.projectId ?? null }),
  });
  return {
    commitStyle: settings.commitStyle,
    voice: settings.voice,
    styleNote: settings.styleNote,
    worktreePath: repo?.worktreePath ?? null,
  };
};
