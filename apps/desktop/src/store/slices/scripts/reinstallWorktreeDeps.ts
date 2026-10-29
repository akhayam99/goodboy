import type { MountId, SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { depsInstallScriptId } from '../../../shared/utils/depsInstallScriptId';
import { lastOutputLine } from '../../../shared/utils/lastOutputLine';
import { worktreeDepsCheck, worktreeDepsUnlink } from '../../../shared/lib/worktreeDepsCheck';
import { NAMES } from '../../../shared/utils/names';
import type { SliceDeps } from '../../slice-types';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly repoPath: string;
  readonly worktreePath: string;
};

export type ReinstallDepsResult =
  | { readonly kind: 'installed' }
  | { readonly kind: 'busy' }
  | { readonly kind: 'failed'; readonly message: string };

const STILL_MISSING = 'The install finished but the dependencies are still not usable here.';

export const reinstallWorktreeDeps = ({ get }: Pick<SliceDeps, 'get'>) => {
  return async ({
    sessionId,
    mountId,
    repoPath,
    worktreePath,
  }: Params): Promise<ReinstallDepsResult> => {
    const scriptId = depsInstallScriptId({ mountId });
    if (get().scriptRuns[sessionId]?.[scriptId]?.status === 'pending') {
      return { kind: 'busy' };
    }
    try {
      const check = await worktreeDepsCheck({ repoPath, worktreePath });
      if (check.command === null || check.state === 'ready' || check.state === 'not-applicable') {
        return { kind: 'installed' };
      }
      if (check.state === 'outside') {
        await worktreeDepsUnlink({ repoPath, worktreePath });
      }
      const result = await get().runDiscoveredScript({
        sessionId,
        scriptId,
        name: NAMES.reinstallDeps,
        command: check.command,
        cwd: worktreePath,
        mountId,
      });
      if (result.exitCode !== 0) {
        const output = result.stderr.trim() === '' ? result.stdout : result.stderr;
        return {
          kind: 'failed',
          message: lastOutputLine({ output }) ?? `The install exited with ${result.exitCode}.`,
        };
      }
      const after = await worktreeDepsCheck({ repoPath, worktreePath });
      return after.state === 'ready' || after.state === 'not-applicable'
        ? { kind: 'installed' }
        : { kind: 'failed', message: STILL_MISSING };
    } catch (error) {
      return { kind: 'failed', message: formatError(error) };
    }
  };
};
