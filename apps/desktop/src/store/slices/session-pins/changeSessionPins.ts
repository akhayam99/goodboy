import { insertWorkspaceValueIfAbsent, replaceWorkspaceValueIfUnchanged } from '@goodboy/db';
import type { WorkspaceId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { serializeSessionPins } from './parseSessionPins';
import { readSessionPins } from './readSessionPins';
import type { SessionPin } from './state';

export type PinsChange = (pins: ReadonlyArray<SessionPin>) => ReadonlyArray<SessionPin>;

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly change: PinsChange;
};

type Attempt =
  | { readonly kind: 'settled'; readonly pins: ReadonlyArray<SessionPin> }
  | { readonly kind: 'lost' };

const MAX_ATTEMPTS = 2;

const attempt = async ({ workspaceId, change }: Params): Promise<Attempt> => {
  const { raw, pins: current } = await readSessionPins({ workspaceId });
  const next = change(current);
  if (next === current) {
    return { kind: 'settled', pins: current };
  }
  const db = tauriDatabase;
  const key = 'sessions.pinned';
  const value = serializeSessionPins({ pins: next });
  const isWritten =
    raw === null
      ? await insertWorkspaceValueIfAbsent({ db, workspaceId, key, value })
      : await replaceWorkspaceValueIfUnchanged({ db, workspaceId, key, expected: raw, value });
  return isWritten ? { kind: 'settled', pins: next } : { kind: 'lost' };
};

export const changeSessionPins = async ({
  workspaceId,
  change,
}: Params): Promise<ReadonlyArray<SessionPin> | null> => {
  for (let tries = 0; tries < MAX_ATTEMPTS; tries += 1) {
    const result = await attempt({ workspaceId, change });
    if (result.kind === 'settled') {
      return result.pins;
    }
  }
  return null;
};
