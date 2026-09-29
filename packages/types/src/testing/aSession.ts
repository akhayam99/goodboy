import type { Session } from '../workspace';
import { TEST_NOW } from './testClock';
import { nextSessionId, nextWorkspaceId } from './testIds';

export const aSession = (overrides: Partial<Session> = {}): Session => ({
  id: nextSessionId(),
  workspaceId: nextWorkspaceId(),
  goal: 'Reconcile the Harborline ledger export',
  state: { kind: 'draft' },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
  permissionMode: 'bypassPermissions',
  autoRun: false,
  titleUserEdited: false,
  workflowRuns: [],
  createdAt: TEST_NOW,
  updatedAt: TEST_NOW,
  ...overrides,
});
