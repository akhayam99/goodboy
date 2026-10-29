import type { AutoLevel } from '@goodboy/core';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { writeAutoLevel } from '../../runtime/auto/level/writeAutoLevel';
import { createSerialQueue } from '../../runtime/state-writes/serialQueue';
import { loadWorkspaceValue } from './loadWorkspaceValue';
import type { SetFn } from './types';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly sessionId: SessionId | null;
  readonly level: AutoLevel;
};

type Deps = {
  readonly set: SetFn;
};

const writes = createSerialQueue();

export const changeAutoLevel = ({ set }: Deps) => {
  const load = loadWorkspaceValue({ set });
  return ({ workspaceId, sessionId, level }: Params): Promise<void> =>
    writes.run({
      key: workspaceId,
      task: async () => {
        const target = sessionId === null ? { workspaceId } : { sessionId };
        await writeAutoLevel({ db: tauriDatabase, target, level });
        await load({ workspaceId, key: 'auto.level' });
      },
    });
};
