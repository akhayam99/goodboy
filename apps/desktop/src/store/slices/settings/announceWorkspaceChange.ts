import type { WorkspaceId } from '@goodboy/types';
import { CHECK_STATE } from '../notifications/errorRecovery';
import { announceDataChanged } from '../../../shared/lib/dataChanged';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly workspaceId: WorkspaceId;
  readonly key: 'auto.level' | 'overrides' | 'home.layout' | 'session.language';
};

export const announceWorkspaceChange = ({ get, workspaceId, key }: Params): void => {
  announceDataChanged({ change: { kind: 'workspace', workspaceId, key } }).catch((error: unknown) =>
    get().reportError({
      recovery: CHECK_STATE,
      title: "Couldn't tell the other windows about a saved setting",
      error,
      severity: 'warning',
      workspaceId,
    }),
  );
};
