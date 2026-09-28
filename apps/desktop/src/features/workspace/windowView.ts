import type { AgentId, SessionId, WorkspaceId } from '@goodboy/types';
import type { Location, Place } from '../../store/slices/navigation/types';
import { parseLocation } from './windowLayout';

const RELOAD_INTENT_KEY = 'goodboy:window-reload-intent';

type RestoreIntent = {
  readonly mode: 'restore';
  readonly workspaceId: WorkspaceId;
  readonly sessionId: SessionId | null;
  readonly agentId: AgentId | null;
  readonly location?: Location;
  readonly layers?: ReadonlyArray<Place>;
};

type LayersParams = {
  readonly intent: WindowReloadIntent;
  readonly sessionId: SessionId;
};

export const restoredLayers = ({ intent, sessionId }: LayersParams): ReadonlyArray<Place> =>
  intent.mode !== 'restore' || !Array.isArray(intent.layers)
    ? []
    : intent.layers.every(
          (place) =>
            typeof place === 'object' &&
            place !== null &&
            place.at === 'session' &&
            place.sessionId === sessionId,
        )
      ? intent.layers
      : [];

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
      const { location: rawLocation, ...rest } = parsed;
      const location = parseLocation({ value: rawLocation });
      return location === null ? rest : { ...rest, location };
    }
    return null;
  } catch {
    return null;
  }
};
