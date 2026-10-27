import { brandId, type SessionId } from '@goodboy/types';
import {
  AUTO_BRIDGE_EVENT,
  type AutoBridgeBus,
} from '../../../features/auto/bridge/autoBridgeProtocol';
import type { GetFn, SetFn } from '../../slice-types';
import { reloadSessionArtifacts } from './reloadSessionArtifacts';

type Params = {
  readonly bus: AutoBridgeBus;
  readonly get: GetFn;
  readonly set: SetFn;
};

type PayloadParams = {
  readonly payload: unknown;
};

const sessionIdOf = ({ payload }: PayloadParams): SessionId | null => {
  if (typeof payload !== 'object' || payload === null || !('sessionId' in payload)) {
    return null;
  }
  const value = payload.sessionId;
  return typeof value === 'string' && value !== '' ? brandId<SessionId>({ value }) : null;
};

export const followArtifactAnnouncements = ({ bus, get, set }: Params): Promise<() => void> =>
  bus.listen({
    event: AUTO_BRIDGE_EVENT.artifactsChanged,
    onPayload: (payload) => {
      const sessionId = sessionIdOf({ payload });
      if (sessionId === null) {
        return;
      }
      const state = get();
      const isLoaded =
        state.sessionPlans[sessionId] !== undefined ||
        state.sessionArtifacts[sessionId] !== undefined;
      if (!isLoaded) {
        return;
      }
      void reloadSessionArtifacts({ get, set, sessionId });
    },
  });
