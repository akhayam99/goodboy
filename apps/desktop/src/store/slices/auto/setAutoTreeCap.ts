import { setAutoTreeCapIfUnchanged, type Database, type SetAutoTreeCapOutcome } from '@goodboy/db';
import type { AutoTreeId } from '@goodboy/types';
import type { AutoDrivePort } from '../../../features/auto/autoDrivePort';

type Params = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
  readonly expectedCapUsd: number | null;
  readonly capUsd: number | null;
  readonly nowMs: number;
  readonly drive: AutoDrivePort | null;
  readonly onDriveError: (error: unknown) => void;
};

type CapParams = {
  readonly capUsd: number | null;
};

const isValidCap = ({ capUsd }: CapParams): boolean =>
  capUsd === null || (Number.isFinite(capUsd) && capUsd > 0);

export const setAutoTreeCap = async ({
  db,
  treeId,
  expectedCapUsd,
  capUsd,
  nowMs,
  drive,
  onDriveError,
}: Params): Promise<SetAutoTreeCapOutcome> => {
  if (!isValidCap({ capUsd })) {
    throw new Error('The limit must be more than zero');
  }
  const outcome = await setAutoTreeCapIfUnchanged({ db, treeId, expectedCapUsd, capUsd, nowMs });
  if (outcome.kind !== 'applied' || drive === null) {
    return outcome;
  }
  await drive({ treeId }).catch(onDriveError);
  return outcome;
};
