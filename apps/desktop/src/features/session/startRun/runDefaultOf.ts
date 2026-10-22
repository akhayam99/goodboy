import type { SessionId, WorkspaceId } from '@goodboy/types';
import { parseRunDefault, runDefaultKey, type RunDefault } from './runDefaultSetting';

type Params = {
  readonly settings: Readonly<Record<string, string | undefined>>;
  readonly workspaceId: WorkspaceId;
  readonly sessionId: SessionId | null;
};

export const runDefaultOf = ({ settings, workspaceId, sessionId }: Params): RunDefault => {
  const sessionDefault =
    sessionId === null
      ? null
      : parseRunDefault({
          raw: settings[runDefaultKey({ scope: { kind: 'session', sessionId } })],
        });
  const workspaceDefault = parseRunDefault({
    raw: settings[runDefaultKey({ scope: { kind: 'workspace', workspaceId } })],
  });
  return sessionDefault ?? workspaceDefault ?? 'auto';
};
