import type { SessionId } from '@goodboy/types';
import { replySettingsOf, type ReplySettings } from '../features/resolve/replySettings';
import type { ResolveStartStyle } from '../features/resolve/startResolve';
import { isAttributionEnabled } from '../shared/utils/attribution';
import { resolveSessionRepo } from './slices/worktrees/resolveSessionRepo';
import type { AppState } from './types';

type Params = {
  readonly state: AppState;
  readonly sessionId: SessionId;
};

export const sessionReplySettings = ({ state, sessionId }: Params): ReplySettings => {
  const session = state.sessions?.find((candidate) => candidate.id === sessionId);
  const projectId = state.sessionActiveProject?.[sessionId] ?? null;
  const project = state.projects?.find((candidate) => candidate.id === projectId);
  const workspace =
    session === undefined ? null : (state.workspaceOverrides?.[session.workspaceId] ?? null);
  return {
    ...replySettingsOf({ layers: [project?.overrides, workspace] }),
    isSigned: isAttributionEnabled({ overrides: workspace }),
  };
};

export const replyVoiceOf = ({
  state,
  sessionId,
}: Params): Pick<ResolveStartStyle, 'voice' | 'styleNote'> => {
  const { voice, styleNote } = sessionReplySettings({ state, sessionId });
  return { voice, styleNote };
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
