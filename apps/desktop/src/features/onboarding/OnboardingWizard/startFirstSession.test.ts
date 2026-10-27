vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectId, WorkspaceId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import type { IssueCandidate } from '../../integrations/fetchIssueCandidates';
import { handOffFirstSession } from './startFirstSession';

const WORKSPACE_ID = 'workspace-harborline' as WorkspaceId;
const PROJECT_ID = 'project-ledger-core' as ProjectId;

type Started = Parameters<ReturnType<StoryStore['getState']>['startSessionFromDraft']>[0];

let useAppStore: StoryStore;
let started: Started[];

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  started = [];
  useAppStore.setState({
    currentWorkspaceId: WORKSPACE_ID,
    startSessionFromDraft: async (input) => {
      started.push(input);
      return aSession({ workspaceId: input.workspaceId });
    },
  });
});

const ISSUE: IssueCandidate = {
  provider: 'linear',
  externalId: 'mock-linear-acm-112',
  identifier: 'ACM-112',
  title: 'Checkout submits twice on a slow network',
  url: 'https://example.invalid/linear/ACM-112',
  goal: 'Checkout submits twice on a slow network',
  body: '',
  branchSlug: 'checkout-submits-twice',
};

describe('handOffFirstSession', () => {
  it('opens the session draft on the picked issue and folder', () => {
    handOffFirstSession({ workspaceId: WORKSPACE_ID, projectId: PROJECT_ID, issue: ISSUE });

    const draft = useAppStore.getState().sessionDrafts[WORKSPACE_ID];
    expect({
      startKind: draft?.startKind,
      projectIds: draft?.projectIds,
      picked: draft?.pickedIssues.map((issue) => issue.identifier),
      goal: draft?.workflowGoal,
    }).toEqual({
      startKind: null,
      projectIds: [PROJECT_ID],
      picked: ['ACM-112'],
      goal: 'Checkout submits twice on a slow network',
    });
    expect(useAppStore.getState().openSessionDraftWorkspaceId).toBe(WORKSPACE_ID);
  });

  it('seeds the ask from the issue title when the issue has no goal', () => {
    handOffFirstSession({
      workspaceId: WORKSPACE_ID,
      projectId: null,
      issue: { ...ISSUE, goal: '  ', title: 'Refund totals drift in payments-api' },
    });

    expect(useAppStore.getState().sessionDrafts[WORKSPACE_ID]?.workflowGoal).toBe(
      'Refund totals drift in payments-api',
    );
  });
});
