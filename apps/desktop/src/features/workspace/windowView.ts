import type { AgentId, SessionId, WorkspaceId } from '@goodboy/types';

const RELOAD_INTENT_KEY = 'goodboy:window-reload-intent';

type RestoreIntent = {
  readonly mode: 'restore';
  readonly workspaceId: WorkspaceId;
  readonly sessionId: SessionId | null;
  readonly agentId: AgentId | null;
};

type FreshIntent = {
  readonly mode: 'fresh';
};

export type WindowReloadIntent = RestoreIntent | FreshIntent;

export const writeReloadIntent = (intent: WindowReloadIntent): void => {
  try {
    sessionStorage.setItem(RELOAD_INTENT_KEY, JSON.stringify(intent));
  } catch {}
};

export const consumeReloadIntent = (): WindowReloadIntent | null => {
  try {
    const raw = sessionStorage.getItem(RELOAD_INTENT_KEY);
    sessionStorage.removeItem(RELOAD_INTENT_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as WindowReloadIntent;
    if (parsed.mode === 'fresh') {
      return parsed;
    }
    if (parsed.mode === 'restore' && typeof parsed.workspaceId === 'string') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
};
