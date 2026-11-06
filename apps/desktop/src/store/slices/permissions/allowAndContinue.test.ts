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
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type ProviderRunId,
  type SessionId,
  type TurnEvent,
} from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';

const AGENT_ID = brandId<AgentId>({ value: 'agent-1' });
const RUN_ID = brandId<ProviderRunId>({ value: 'run-1' });
const ASKED_AT = brandId<IsoDateTime>({ value: '2026-11-06T10:00:00.000Z' });
const session = aSession({ goal: 'Refund the duplicate payout' });
const SESSION_ID: SessionId = session.id;

type Resumed = {
  readonly sessionId: SessionId;
  readonly content: string;
  readonly permissionOnceAllows?: ReadonlyArray<string>;
};

let useAppStore: StoryStore;
let resumed: Resumed[];

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  resumed = [];
  useAppStore.setState({
    sessions: [session],
    sendTurn: async (input) => {
      resumed.push({
        sessionId: input.sessionId,
        content: input.content,
        permissionOnceAllows: input.permissionOnceAllows,
      });
      return { blockedOverBudget: false };
    },
  });
});

const decisionsOf = (): ReadonlyArray<Extract<TurnEvent, { kind: 'permission_decision' }>> =>
  (useAppStore.getState().transcripts[AGENT_ID] ?? []).filter(
    (event): event is Extract<TurnEvent, { kind: 'permission_decision' }> =>
      event.kind === 'permission_decision',
  );

type AskParams = {
  readonly toolUseId: string;
  readonly command: string;
};

const askOf = ({ toolUseId, command }: AskParams): TurnEvent => ({
  kind: 'permission_request',
  runId: RUN_ID,
  toolUseId,
  toolName: 'Bash',
  input: { command },
  at: ASKED_AT,
});

const seedTwoAsks = (): void => {
  useAppStore.setState({
    transcripts: {
      [AGENT_ID]: [
        askOf({ toolUseId: 'tu-1', command: 'pnpm test' }),
        askOf({ toolUseId: 'tu-2', command: 'pnpm build' }),
      ],
    },
    agentTurnState: { [AGENT_ID]: { kind: 'blocked', runId: RUN_ID, blockedAt: ASKED_AT } },
  });
};

const allow = async ({ toolUseId, command }: AskParams): Promise<void> => {
  await useAppStore.getState().allowAndContinue({
    sessionId: SESSION_ID,
    agentId: AGENT_ID,
    toolUseId,
    toolName: 'Bash',
    input: { command },
    runId: RUN_ID,
  });
};

const askTarget = (toolUseId: string) => ({
  sessionId: SESSION_ID,
  agentId: AGENT_ID,
  toolUseId,
  toolName: 'Bash',
  runId: RUN_ID,
});

describe('two asks of one agent', () => {
  it('holds the turn until the last ask is answered, then carries both answers', async () => {
    seedTwoAsks();

    await allow({ toolUseId: 'tu-1', command: 'pnpm test' });

    expect(resumed).toEqual([]);

    await allow({ toolUseId: 'tu-2', command: 'pnpm build' });

    expect(resumed).toHaveLength(1);
    expect(resumed[0]?.permissionOnceAllows).toEqual(['Bash(pnpm test)', 'Bash(pnpm build)']);
    expect(resumed[0]?.content).toContain('Permission for Bash is granted for this one call.');
  });

  it('tells the agent the denial it holds when the last ask is allowed', async () => {
    seedTwoAsks();

    await useAppStore.getState().denyWithReason({ ...askTarget('tu-1'), reason: 'Not the tests' });
    expect(resumed).toEqual([]);

    await allow({ toolUseId: 'tu-2', command: 'pnpm build' });

    expect(resumed[0]?.content).toContain('Denied Bash. Not the tests');
    expect(resumed[0]?.permissionOnceAllows).toEqual(['Bash(pnpm build)']);
  });

  it('carries the allow it holds through a last deny', async () => {
    seedTwoAsks();

    await allow({ toolUseId: 'tu-1', command: 'pnpm test' });
    await useAppStore.getState().denyWithReason({ ...askTarget('tu-2'), reason: 'No build' });

    expect(resumed).toHaveLength(1);
    expect(resumed[0]?.content).toContain('Denied Bash. No build');
    expect(resumed[0]?.permissionOnceAllows).toEqual(['Bash(pnpm test)']);
  });

  it('carries the allow it holds through a last rule', async () => {
    seedTwoAsks();

    await allow({ toolUseId: 'tu-1', command: 'pnpm test' });
    await useAppStore.getState().allowWithRule({
      ...askTarget('tu-2'),
      scope: 'session',
      pattern: { tool: 'Bash' },
    });

    expect(resumed).toHaveLength(1);
    expect(resumed[0]?.content).toContain('Retry the tool call that was blocked');
    expect(resumed[0]?.permissionOnceAllows).toEqual(['Bash(pnpm test)']);
  });

  it('carries the allow it holds through a last Never allow', async () => {
    seedTwoAsks();

    await allow({ toolUseId: 'tu-1', command: 'pnpm test' });
    await useAppStore.getState().neverAllowTool({
      ...askTarget('tu-2'),
      pattern: { tool: 'Bash' },
    });

    expect(resumed).toHaveLength(1);
    expect(resumed[0]?.content).toContain('Denied Bash for this one call.');
    expect(resumed[0]?.permissionOnceAllows).toEqual(['Bash(pnpm test)']);
  });
});

describe('neverAllowTool', () => {
  it('starts no turn for a lone ask and lets the queue go on', async () => {
    const drainAgentQueue = vi.fn(async () => undefined);
    useAppStore.setState({
      drainAgentQueue,
      transcripts: { [AGENT_ID]: [askOf({ toolUseId: 'tu-1', command: 'pnpm test' })] },
    });

    await useAppStore.getState().neverAllowTool({
      ...askTarget('tu-1'),
      pattern: { tool: 'Bash' },
    });

    expect(resumed).toEqual([]);
    expect(drainAgentQueue).toHaveBeenCalledWith({ sessionId: SESSION_ID, agentId: AGENT_ID });
  });
});

describe('allowAndContinue', () => {
  it('grants exactly the requested call and resumes the turn with the exact-command pattern', async () => {
    await useAppStore.getState().allowAndContinue({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      toolUseId: 'tu-1',
      toolName: 'Bash',
      input: { command: 'pnpm test --filter ledger-core' },
      runId: RUN_ID,
    });

    expect(useAppStore.getState().volatilePermissionAllows.has('tu-1')).toBe(true);
    expect(useAppStore.getState().volatilePermissionAllows.size).toBe(1);
    expect(resumed).toEqual([
      expect.objectContaining({
        sessionId: SESSION_ID,
        permissionOnceAllows: ['Bash(pnpm test --filter ledger-core)'],
      }),
    ]);
  });

  it('records a once decision in the transcript before resuming', async () => {
    await useAppStore.getState().allowAndContinue({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      toolUseId: 'tu-2',
      toolName: 'Edit',
      input: { file_path: '/repo/src/refund.ts' },
      runId: RUN_ID,
    });

    expect(
      decisionsOf().map(({ toolUseId, decision, scope }) => ({ toolUseId, decision, scope })),
    ).toEqual([{ toolUseId: 'tu-2', decision: 'allow', scope: 'once' }]);
    expect(resumed).toHaveLength(1);
  });
});
