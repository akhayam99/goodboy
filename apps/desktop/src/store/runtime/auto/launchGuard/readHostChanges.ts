import { pathsOfPatch } from '@goodboy/core/auto';
import type { DiffRangeParams } from '../../../../features/worktree/worktree';
import type { DiffFromMergeBaseParams } from '../../../../features/worktree/worktreeDiffFromMergeBase';
import type { AutoPorts, HostChanges, ReadHostChangesParams } from '../ports';
import type { RemoteHeadReaders } from '../readRemoteHead';

export type BaseBranchParams = Pick<ReadHostChangesParams, 'sessionId' | 'worktreePath'>;

export type HostChangeReaders = Readonly<{
  baseBranchOf: (params: BaseBranchParams) => string | null;
  remoteHeadOf: RemoteHeadReaders['remoteHeadOf'];
  diffRange: (params: DiffRangeParams) => Promise<string>;
  diffFromMergeBase: (params: DiffFromMergeBaseParams) => Promise<string>;
}>;

type Params = {
  readonly readers: HostChangeReaders;
};

type FromBaseParams = Params & {
  readonly params: ReadHostChangesParams;
};

const NO_BASE = 'this mount has no base branch, so the files to push cannot be listed';

const fromBaseOf = async ({ readers, params }: FromBaseParams): Promise<string> => {
  const { sessionId, worktreePath, head } = params;
  const base = readers.baseBranchOf({ sessionId, worktreePath });
  if (base === null) {
    throw new Error(NO_BASE);
  }
  return readers
    .diffFromMergeBase({ worktreePath, base: `origin/${base}`, head })
    .catch(() => readers.diffFromMergeBase({ worktreePath, base, head }));
};

type PatchParams = {
  readonly patch: string;
};

const changesOf = ({ patch }: PatchParams): HostChanges => ({
  paths: pathsOfPatch({ patch }),
  patch,
});

export const readHostChanges =
  ({ readers }: Params): AutoPorts['readHostChanges'] =>
  async ({ sessionId, worktreePath, branch, head }: ReadHostChangesParams) => {
    const params = { sessionId, worktreePath, branch, head };
    const hostHead = await readers.remoteHeadOf({ worktreePath, branch });
    if (hostHead === null || hostHead === '') {
      return changesOf({ patch: await fromBaseOf({ readers, params }) });
    }
    if (hostHead === head) {
      return changesOf({ patch: '' });
    }
    const patch = await readers
      .diffRange({ worktreePath, base: hostHead, head })
      .catch(() => fromBaseOf({ readers, params }));
    return changesOf({ patch });
  };
