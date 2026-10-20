import type { RemoteRead } from '@goodboy/core';
import type { ReadRemoteHeadParams } from './ports';

export type BranchOfParams = Readonly<{ worktreePath: string }>;

type RemoteHeadOfParams = Readonly<{ worktreePath: string; branch: string }>;

export type RemoteHeadReaders = Readonly<{
  branchOf: (params: BranchOfParams) => Promise<string | null>;
  remoteHeadOf: (params: RemoteHeadOfParams) => Promise<string | null>;
}>;

type Params = {
  readonly readers: RemoteHeadReaders;
  readonly params: ReadRemoteHeadParams;
};

const UNKNOWN: RemoteRead = { kind: 'unknown' };

export const readRemoteHead = async ({ readers, params }: Params): Promise<RemoteRead> => {
  try {
    const branch = params.branch ?? (await readers.branchOf({ worktreePath: params.worktreePath }));
    if (branch === null || branch === '') {
      return UNKNOWN;
    }
    const sha = await readers.remoteHeadOf({ worktreePath: params.worktreePath, branch });
    return sha === null || sha === '' ? { kind: 'absent', branch } : { kind: 'sha', branch, sha };
  } catch {
    return UNKNOWN;
  }
};
