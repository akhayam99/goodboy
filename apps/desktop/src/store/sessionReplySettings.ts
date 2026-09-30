import type { SessionId } from '@goodboy/types';
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

export const sessionReplySettings = ({ state, sessionId }: Params): ReplySettings => {
  const session = sessionById(state.sessions, sessionId);
  const projectId = state.sessionActiveProject?.[sessionId] ?? null;
  const project = projectById(state.projects, projectId);
  const workspace =
    session === undefined ? null : (state.workspaceOverrides?.[session.workspaceId] ?? null);
  return {
    ...replySettingsOf({ layers: [project?.overrides, workspace] }),
    isSigned: isAttributionEnabled({ overrides: workspace }),
  };
};

export const sessionResolveStyle = ({ state, sessionId }: Params): ResolveStartStyle => {
  const settings = sessionReplySettings({ state, sessionId });
  return {
    commitStyle: settings.commitStyle,
    voice: settings.voice,
    styleNote: settings.styleNote,
    worktreePath: resolveSessionRepo({ state, sessionId })?.worktreePath ?? null,
  };
};
