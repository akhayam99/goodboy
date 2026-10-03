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
import { scoutKickoffPrompt } from '../../session/components/SessionKickoff/AgentStart';
import { handOffFirstSession, startFirstScout } from './startFirstSession';

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

describe('startFirstScout', () => {
  it('starts the first session from a scout draft in the picked project, the prompt as its focus', async () => {
    await startFirstScout({
      workspaceId: WORKSPACE_ID,
      projectId: PROJECT_ID,
      prompt: 'Find one small bug',
    });

    expect(useAppStore.getState().sessionDrafts[WORKSPACE_ID]?.projectId).toBe(PROJECT_ID);
    expect(started).toEqual([
      {
        workspaceId: WORKSPACE_ID,
        start: {
          kind: 'scout',
          agentKind: 'scout',
          focus: 'Find one small bug',
          prompt: scoutKickoffPrompt({ focus: 'Find one small bug' }),
          routing: null,
        },
      },
    ]);
  });
});

describe('handOffFirstSession', () => {
  it('opens the session draft on the picked choice and project', () => {
    handOffFirstSession({ workspaceId: WORKSPACE_ID, projectId: PROJECT_ID, choice: 'workflow' });

    const draft = useAppStore.getState().sessionDrafts[WORKSPACE_ID];
    expect({ choice: draft?.choice, projectId: draft?.projectId }).toEqual({
      choice: 'workflow',
      projectId: PROJECT_ID,
    });
    expect(useAppStore.getState().openSessionDraftWorkspaceId).toBe(WORKSPACE_ID);
  });
});
