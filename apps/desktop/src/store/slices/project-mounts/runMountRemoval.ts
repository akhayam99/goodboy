import type { WorktreeRemovalMode } from '@goodboy/types';
import { cleanupMountDirectory } from '../mount-cleanup';
import type { MountCleanupResult } from '../mount-cleanup/cleanupPolicy';
import type { CleanupTarget } from '../mount-cleanup/types';
import { mountError } from './mountErrors';
import { withRepositoryAndMountLock } from './mountLocks';
import {
  beginMountOperation,
  failMountOperation,
  markMountOperationUncertain,
  succeedMountOperation,
} from './mountOperations';
import type { GetFn } from './types';

export type MountRemovalFinish = 'clear-path' | 'drop-row';

export const MOUNT_REMOVAL_FINISHES: ReadonlyArray<MountRemovalFinish> = ['clear-path', 'drop-row'];

type Params = {
  readonly get: GetFn;
  readonly target: CleanupTarget;
  readonly mode: WorktreeRemovalMode;
  readonly keepDirectory: boolean;
  readonly finish: MountRemovalFinish;
  readonly expectedRevision: number;
  readonly finishRow: (cleanup: MountCleanupResult) => Promise<boolean>;
};

const errorCodeOf = ({ error }: { readonly error: unknown }): string => {
  if (error === null || typeof error !== 'object') {
    return 'unknown-state';
  }
  const code = (error as { readonly code?: unknown }).code;
  return typeof code === 'string' ? code : 'unknown-state';
};

export const runMountRemoval = async ({
  get,
  target,
  mode,
  keepDirectory,
  finish,
  expectedRevision,
  finishRow,
}: Params): Promise<MountCleanupResult> =>
  withRepositoryAndMountLock({
    repoRoot: target.repoRoot,
    mountKey: `${target.sessionId}:${target.mountId}`,
    run: async () => {
      const operation = await beginMountOperation({
        sessionId: target.sessionId,
        requestId: crypto.randomUUID(),
        kind: 'remove',
        mountId: target.mountId,
        expectedRevision,
        input: {
          mountId: target.mountId,
          repoRoot: target.repoRoot,
          worktreePath: target.worktreePath,
          keepDirectory: keepDirectory || !target.isRepoProject,
          finish,
        },
      });
      const cleanup = await cleanupMountDirectory({ get, target, keepDirectory, mode });
      if (cleanup.decision.kind === 'failed') {
        await failMountOperation({ operation, errorCode: 'cleanup-failed' });
        return cleanup;
      }
      const settled = finish === 'drop-row' ? { ...operation, mountId: null } : operation;
      const written = await finishRow(cleanup).catch(async (error: unknown) => {
        await markMountOperationUncertain({
          operation: settled,
          errorCode: errorCodeOf({ error }),
        }).catch(() => undefined);
        throw error;
      });
      if (!written) {
        await markMountOperationUncertain({ operation: settled, errorCode: 'revision-conflict' });
        throw mountError({
          code: 'revision-conflict',
          message: 'the mount changed while removing its worktree',
          mountId: target.mountId,
        });
      }
      await succeedMountOperation({ operation: settled });
      return cleanup;
    },
  });
