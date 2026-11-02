import type { SessionId } from '@goodboy/types';
import { materializationSeedFor, rememberMaterializationSeed } from './materializationSeeds';

type SessionParams = {
  readonly sessionId: SessionId;
};

type BranchParams = SessionParams & {
  readonly branch: string;
};

type WorktreeParams = BranchParams & {
  readonly worktreePath: string;
};

export const rememberPickedBranch = ({ sessionId, branch }: BranchParams): void => {
  rememberMaterializationSeed({
    sessionId,
    seed: { ...materializationSeedFor({ sessionId }), existingBranch: branch },
  });
};

export const rememberExistingWorktree = ({
  sessionId,
  branch,
  worktreePath,
}: WorktreeParams): void => {
  rememberMaterializationSeed({
    sessionId,
    seed: {
      ...materializationSeedFor({ sessionId }),
      existingBranch: branch,
      existingWorktreePath: worktreePath,
    },
  });
};

export const rememberNewBranchChoice = ({ sessionId }: SessionParams): void => {
  const {
    existingBranch: _branch,
    existingWorktreePath: _path,
    ...rest
  } = materializationSeedFor({ sessionId }) ?? {};
  rememberMaterializationSeed({ sessionId, seed: { ...rest, isGoalBranchIgnored: true } });
};
