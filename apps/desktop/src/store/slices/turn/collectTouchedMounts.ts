import { hasOtherSessionTurnSince } from '@goodboy/db';
import type { AgentId, IsoDateTime, MountId, SessionId, SessionProjectMount } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn } from '../../slice-types';
import { snapshotMountChanges } from './snapshotMountChanges';
import { touchedMountIds, type MountChangeSnapshot } from './touchedMountIds';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly mounts: ReadonlyArray<SessionProjectMount>;
  readonly workingDir: string;
  readonly editedPaths: ReadonlyArray<string>;
  readonly before: Promise<MountChangeSnapshot>;
  readonly startedAt: IsoDateTime;
};

type SharedParams = Pick<Params, 'get' | 'sessionId' | 'agentId' | 'startedAt'>;

const isTurnShared = async ({
  get,
  sessionId,
  agentId,
  startedAt,
}: SharedParams): Promise<boolean> => {
  const state = get();
  const isOtherRunning = (state.sessionPhaseRuns[sessionId] ?? []).some(
    (agent) => agent.id !== agentId && state.agentTurnState[agent.id]?.kind === 'running',
  );
  if (isOtherRunning) {
    return true;
  }
  return hasOtherSessionTurnSince({
    db: tauriDatabase,
    sessionId,
    agentId,
    sinceMs: Date.parse(startedAt),
  });
};

export const collectTouchedMounts = async ({
  get,
  sessionId,
  agentId,
  mounts,
  workingDir,
  editedPaths,
  before,
  startedAt,
}: Params): Promise<ReadonlyArray<MountId>> => {
  const fromEdits = (): ReadonlyArray<MountId> =>
    touchedMountIds({
      mounts,
      workingDir,
      editedPaths,
      before: new Map(),
      after: new Map(),
      isShared: true,
    });
  try {
    const [snapshotBefore, isShared] = await Promise.all([
      before,
      isTurnShared({ get, sessionId, agentId, startedAt }),
    ]);
    const after = isShared ? new Map() : await snapshotMountChanges({ mounts });
    return touchedMountIds({
      mounts,
      workingDir,
      editedPaths,
      before: snapshotBefore,
      after,
      isShared,
    });
  } catch (error) {
    console.error('touched worktrees check failed', error);
    return fromEdits();
  }
};
