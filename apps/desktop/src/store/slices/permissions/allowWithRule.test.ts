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
import { brandId, type AgentId, type ProviderRunId, type SessionId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  STORY_NOW,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../storyHarness';

const AGENT_ID = brandId<AgentId>({ value: 'agent-1' });
const RUN_ID = brandId<ProviderRunId>({ value: 'run-1' });
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

const allow = () =>
  useAppStore.getState().allowWithRule({
    sessionId: SESSION_ID,
    agentId: AGENT_ID,
    toolUseId: 'tu-1',
    toolName: 'Bash',
    runId: RUN_ID,
    scope: 'workspace',
    pattern: { tool: 'Bash', argsMatcher: 'pnpm test *' },
  });

describe('allowWithRule', () => {
  it('writes the rule first, then resumes the blocked call without a Retry click', async () => {
    await allow();

    expect(storySpies.invokePermissionRuleUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'workspace',
        patternTool: 'Bash',
        patternArgsMatcher: 'pnpm test *',
        decision: 'allow',
      }),
    );
    expect(followUps).toEqual([
      {
        agentId: AGENT_ID,
        content:
          'Permission for Bash is now granted.\nRetry the tool call that was blocked, then continue where you stopped.',
      },
    ]);
  });

  it('records the decision in the transcript before it resumes', async () => {
    await allow();

    const decisions = (useAppStore.getState().transcripts[AGENT_ID] ?? []).filter(
      (event) => event.kind === 'permission_decision',
    );
    expect(decisions).toHaveLength(1);
  });

  it('does not resume, and says so by rejecting, when the rule cannot be written', async () => {
    storySpies.invokePermissionRuleUpsert.mockRejectedValueOnce(new Error('database is locked'));

    await expect(allow()).rejects.toThrow('database is locked');

    expect(followUps).toEqual([]);
    expect(useAppStore.getState().transcripts[AGENT_ID] ?? []).toEqual([]);
  });

  it('keeps the rule and starts no second turn when the agent already runs', async () => {
    useAppStore.setState({
      agentTurnState: { [AGENT_ID]: { kind: 'running', runId: RUN_ID, startedAt: STORY_NOW } },
    });

    await allow();

    expect(storySpies.invokePermissionRuleUpsert).toHaveBeenCalledTimes(1);
    expect(followUps).toEqual([]);
  });
});
