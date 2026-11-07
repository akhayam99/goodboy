import {
  brandId,
  type MountId,
  type ProjectId,
  type SessionId,
  type SessionMountView,
} from '@goodboy/types';
import { TEST_NOW } from '@goodboy/types/testing';

type Params = {
  readonly key: string;
  readonly sessionId: SessionId;
  readonly projectId: ProjectId;
  readonly projectName: string;
  readonly branch: string;
  readonly isAttached?: boolean;
};

export const aMountView = ({
  key,
  sessionId,
  projectId,
  projectName,
  branch,
  isAttached = true,
}: Params): SessionMountView => ({
  id: brandId<MountId>({ value: `mount-${key}` }),
  sessionId,
  projectId,
  worktreePath: `/work/${projectName}-${key}`,
  lastWorktreePath: null,
  branch,
  baseBranch: 'main',
  parallelIndex: 0,
  mountName: projectName,
  repoSlug: null,
  isAttached,
  diskState: 'present',
  revision: 1,
  createdAt: TEST_NOW,
  updatedAt: TEST_NOW,
  repoRoot: `/work/${projectName}`,
});
