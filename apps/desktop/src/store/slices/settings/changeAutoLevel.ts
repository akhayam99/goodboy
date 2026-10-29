import type { AutoLevel } from '@goodboy/core';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { writeAutoLevel } from '../../runtime/auto/level/writeAutoLevel';
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

export const changeAutoLevel = ({ set }: Deps) => {
  const load = loadWorkspaceValue({ set });
  return async ({ workspaceId, sessionId, level }: Params): Promise<void> => {
    const target = sessionId === null ? { workspaceId } : { sessionId };
    await writeAutoLevel({ db: tauriDatabase, target, level });
    await load({ workspaceId, key: 'auto.level' });
  };
};
