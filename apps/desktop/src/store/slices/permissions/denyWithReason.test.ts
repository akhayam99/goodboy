vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);
vi.mock('../../../features/permissions/permissions', async () =>
  (await import('../../storyHarness')).permissionsModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentId, ProviderRunId, SessionId, TurnEvent } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  STORY_NOW,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../storyHarness';

const AGENT_ID = 'agent-1' as AgentId;
const RUN_ID = 'run-1' as ProviderRunId;
const session = aSession({ goal: 'Refund the duplicate payout' });
const SESSION_ID: SessionId = session.id;

type FollowUp = { readonly agentId?: AgentId; readonly content: string };

let useAppStore: StoryStore;
let followUps: FollowUp[];

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  followUps = [];
  useAppStore.setState({
    sessions: [session],
    sendTurn: async (input) => {
      followUps.push({ agentId: input.agentId, content: input.content });
      return { blockedOverBudget: false };
    },
  });
});

const deny = (params: { readonly toolUseId: string; readonly reason: string }) =>
  useAppStore.getState().denyWithReason({
    sessionId: SESSION_ID,
    agentId: AGENT_ID,
    toolName: 'Bash',
    runId: RUN_ID,
    ...params,
  });

const denialsOf = (): ReadonlyArray<{ readonly toolUseId: string; readonly scope?: string }> =>
  (useAppStore.getState().transcripts[AGENT_ID] ?? [])
    .filter(
      (event): event is Extract<TurnEvent, { kind: 'permission_decision' }> =>
        event.kind === 'permission_decision' && event.decision === 'deny',
    )
    .map((event) => ({ toolUseId: event.toolUseId, scope: event.scope }));

describe('denyWithReason', () => {
  it('denies this call only and tells the agent why in the same session', async () => {
    await deny({ toolUseId: 'tu-1', reason: 'this would touch production data' });

    expect(denialsOf()).toEqual([{ toolUseId: 'tu-1', scope: 'once' }]);
    expect(storySpies.invokePermissionRuleUpsert).not.toHaveBeenCalled();
    expect(followUps).toEqual([
      { agentId: AGENT_ID, content: 'Denied Bash. this would touch production data' },
    ]);
  });

  it('writes no rule and tells the agent the denial covers one call when no reason is given', async () => {
    await deny({ toolUseId: 'tu-2', reason: '   ' });

    expect(denialsOf()).toEqual([{ toolUseId: 'tu-2', scope: 'once' }]);
    expect(storySpies.invokePermissionRuleUpsert).not.toHaveBeenCalled();
    expect(followUps).toEqual([
      {
        agentId: AGENT_ID,
        content:
          'Denied Bash for this one call. Do not run it; carry on another way, or say what you need.',
      },
    ]);
  });

  it('does not pile a second turn onto one already running', async () => {
    useAppStore.setState({
      agentTurnState: { [AGENT_ID]: { kind: 'running', runId: RUN_ID, startedAt: STORY_NOW } },
    });

    await deny({ toolUseId: 'tu-3', reason: 'wait for the tests first' });

    expect(denialsOf()).toEqual([{ toolUseId: 'tu-3', scope: 'once' }]);
    expect(followUps).toEqual([]);
  });

  it('leaves the next call of the same tool free to ask again', async () => {
    await deny({ toolUseId: 'tu-4', reason: '' });

    expect(useAppStore.getState().volatilePermissionAllows.size).toBe(0);
    expect(storySpies.invokePermissionRuleUpsert).not.toHaveBeenCalled();
  });
});
