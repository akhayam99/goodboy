import type { Workspace } from '../workspace';
import { EMPTY_OVERRIDES } from './emptyOverrides';
import { TEST_NOW } from './testClock';
import { nextWorkspaceId } from './testIds';

export const aWorkspace = (overrides: Partial<Workspace> = {}): Workspace => ({
  id: nextWorkspaceId(),
  name: 'Harborline',
  slug: 'harborline',
  overrides: EMPTY_OVERRIDES,
  createdAt: TEST_NOW,
  updatedAt: TEST_NOW,
  ...overrides,
});
