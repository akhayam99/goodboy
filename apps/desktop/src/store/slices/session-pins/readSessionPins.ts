import { getSetting, listLiveSessionIds } from '@goodboy/db';
import type { WorkspaceId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { parseSessionPins, pruneSessionPins } from './parseSessionPins';
import { sessionPinsKey } from './sessionPinsKey';
import type { SessionPin } from './state';

type Params = {
  readonly workspaceId: WorkspaceId;
};

export type StoredSessionPins = {
  readonly raw: string | null;
  readonly pins: ReadonlyArray<SessionPin>;
};

export const readSessionPins = async ({ workspaceId }: Params): Promise<StoredSessionPins> => {
  const [raw, liveIds] = await Promise.all([
    getSetting(tauriDatabase, sessionPinsKey({ workspaceId })),
    listLiveSessionIds({ db: tauriDatabase, workspaceId }),
  ]);
  return {
    raw,
    pins: pruneSessionPins({ pins: parseSessionPins({ raw }), liveIds: new Set(liveIds) }),
  };
};
