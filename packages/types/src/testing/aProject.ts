import type { Project } from '../workspace';
import { EMPTY_OVERRIDES } from './emptyOverrides';
import { TEST_NOW } from './testClock';
import { nextProjectId, nextWorkspaceId } from './testIds';

export const aProject = (overrides: Partial<Project> = {}): Project => ({
  id: nextProjectId(),
  workspaceId: nextWorkspaceId(),
  name: 'ledger-core',
  rootPath: '/tmp/ledger-core',
  kind: 'repo',
  overrides: EMPTY_OVERRIDES,
  createdAt: TEST_NOW,
  updatedAt: TEST_NOW,
  ...overrides,
});
