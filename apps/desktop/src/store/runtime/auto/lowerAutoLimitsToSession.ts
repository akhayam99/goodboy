import { lowerAutoTreeCapsOfSession, type Database } from '@goodboy/db';
import type { AutoTreeId, SessionId } from '@goodboy/types';
import type { AutoDrivePort } from '../../../features/auto/autoDrivePort';

type DriveErrorParams = {
  readonly error: unknown;
};

type Params = {
  readonly db: Database;
  readonly sessionId: SessionId;
  readonly capUsd: number;
  readonly nowMs: number;
  readonly drive: AutoDrivePort | null;
  readonly onDriveError: (params: DriveErrorParams) => void;
};

export const lowerAutoLimitsToSession = async ({
  db,
  sessionId,
  capUsd,
  nowMs,
  drive,
  onDriveError,
}: Params): Promise<ReadonlyArray<AutoTreeId>> => {
  const lowered = await lowerAutoTreeCapsOfSession({ db, sessionId, capUsd, nowMs });
  if (drive === null) {
    return lowered;
  }
  for (const treeId of lowered) {
    await drive({ treeId }).catch((error: unknown) => onDriveError({ error }));
  }
  return lowered;
};
