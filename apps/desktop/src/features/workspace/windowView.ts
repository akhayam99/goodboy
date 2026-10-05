import type { AgentId, SessionId, WorkspaceId } from '@goodboy/types';
import type { Location } from '../../store/slices/navigation/types';
import { STORAGE_KEYS, persistedPref } from '../../shared/lib/storage-keys';
import { parseLocation } from './windowLayout';

type RestoreIntent = {
  readonly mode: 'restore';
  readonly workspaceId: WorkspaceId;
  readonly sessionId: SessionId | null;
  readonly agentId: AgentId | null;
  readonly location?: Location;
};

type FreshIntent = {
  readonly mode: 'fresh';
};

export type WindowReloadIntent = RestoreIntent | FreshIntent;

const intentPref = persistedPref<WindowReloadIntent | null>({
  key: STORAGE_KEYS.windowReloadIntent,
  area: 'session',
  fallback: null,
  parse: (raw) => {
    const parsed = JSON.parse(raw) as WindowReloadIntent;
    if (parsed.mode === 'fresh') {
      return parsed;
    }
    if (parsed.mode === 'restore' && typeof parsed.workspaceId === 'string') {
      const { location: rawLocation, ...rest } = parsed;
      const location = parseLocation({ value: rawLocation });
      return location === null ? rest : { ...rest, location };
    }
    return undefined;
  },
});

export const writeReloadIntent = (intent: WindowReloadIntent): void => intentPref.write(intent);

export const consumeReloadIntent = (): WindowReloadIntent | null => {
  const intent = intentPref.read();
  intentPref.clear();
  return intent;
};
