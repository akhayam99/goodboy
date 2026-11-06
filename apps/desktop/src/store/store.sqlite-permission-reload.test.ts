import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  findUndecidedPermissionAsk,
  insertAgent,
  insertSession,
  insertTurnEvent,
  insertWorkspace,
  listAgentsForSessions,
  recordAgentStatus,
} from '@goodboy/db';
import {
  brandId,
  type AgentId,
  type ProviderRunId,
  type SessionId,
  type TurnEvent,
  type WorkspaceId,
} from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  STORY_NOW,
  buildStorySession,
  buildStoryWorkspace,
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySpies,
  storySqlite,
  stubStoryInvoke,
  type StoryStore,
} from './storyHarness';
import { openPermissionAsksOf } from '../features/permissions/openPermissionAsksOf';
import { writeReloadIntent } from '../features/workspace/windowView';
import { stageInfosOf } from './slices/session-view/stageInfosOf';
import { cancelledRunIds } from './slices/sessions/sessionMutators';
import { flushTurnEvents } from './slices/transcripts/buffer';

vi.mock('@tauri-apps/api/core', async () => (await import('./storyHarness')).tauriCoreModuleMock());
vi.mock('@tauri-apps/api/event', async () =>
  (await import('./storyHarness')).tauriEventModuleMock(),
);
vi.mock('../shared/lib/db', async () => (await import('./storyHarness')).sqliteDbLibModuleMock());
vi.mock('../shared/lib/dbBoot', async () => (await import('./storyHarness')).dbBootModuleMock());
vi.mock('../features/onboarding/onboardingSettings', async () =>
  (await import('./storyHarness')).onboardingStoreModuleMock(),
);
vi.mock('../features/chat/turn', async () => (await import('./storyHarness')).turnModuleMock());
vi.mock('../features/permissions/permissions', async () =>
  (await import('./storyHarness')).permissionsModuleMock(),
);
vi.mock('../features/providers/providers', async () =>
  (await import('./storyHarness')).providersModuleMock(),
);
vi.mock('../features/providers/routing', async () =>
  (await import('./storyHarness')).routingModuleMock(),
);
vi.mock('../features/budget/budget', async () =>
  (await import('./storyHarness')).budgetModuleMock(),
);
vi.mock('../features/workflows/workflows', async () =>
  (await import('./storyHarness')).workflowsModuleMock(),
);
vi.mock('../features/worktree/worktree', async () =>
  (await import('./storyHarness')).worktreeModuleMock(),
);
vi.mock('../shared/lib/repo', async () => (await import('./storyHarness')).repoModuleMock());
vi.mock('../features/plans/plans', async () => (await import('./storyHarness')).plansModuleMock());

const HARBORLINE_ID = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const NORTHWIND_ID = brandId<WorkspaceId>({ value: 'workspace-northwind' });
const LEDGER_ID = brandId<SessionId>({ value: 'session-ledger' });
const AGENT_ID = brandId<AgentId>({ value: 'agent-ledger' });
const RUN_ID = brandId<ProviderRunId>({ value: 'run-ledger-ask' });
const TOOL_USE_ID = 'tool-ledger-migrate';

let useAppStore: StoryStore;

async function* endedStream(): AsyncIterable<TurnEvent> {}

const prepareReload = (): void => {
  stubStoryInvoke({ turn_list_live: () => [] });
  writeReloadIntent({
    mode: 'restore',
    workspaceId: HARBORLINE_ID,
    sessionId: LEDGER_ID,
    agentId: AGENT_ID,
  });
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  sessionStorage.clear();
  const db = await openStorySqlite();
  await insertWorkspace({
    db,
    workspace: buildStoryWorkspace({ id: HARBORLINE_ID, name: 'Harborline', slug: 'harborline' }),
  });
  await insertWorkspace({
    db,
    workspace: buildStoryWorkspace({ id: NORTHWIND_ID, name: 'Northwind', slug: 'northwind' }),
  });
  await insertSession(
    db,
    buildStorySession({ id: LEDGER_ID, workspaceId: HARBORLINE_ID, goal: 'Migrate ledger-core' }),
  );
  await insertAgent(db, {
    id: AGENT_ID,
    sessionId: LEDGER_ID,
    ordinal: 0,
    name: 'implementer',
    status: 'running',
    providerRunId: RUN_ID,
  });
  await insertTurnEvent(db, {
    id: 'event-ledger-ask',
    sessionId: LEDGER_ID,
    agentId: AGENT_ID,
    event: {
      kind: 'permission_request',
      runId: RUN_ID,
      toolUseId: TOOL_USE_ID,
      toolName: 'Bash',
      input: { command: 'pnpm db:migrate' },
      at: STORY_NOW,
    },
  });
  prepareReload();
});

const savedStatus = async (): Promise<string | undefined> =>
  (await listAgentsForSessions(storySqlite(), [LEDGER_ID]))
    .get(LEDGER_ID)
    ?.find((agent) => agent.id === AGENT_ID)?.status;

const expectStillWaiting = async (): Promise<void> => {
  expect(await savedStatus()).toBe('running');
  const state = useAppStore.getState();
  expect(state.sessionPhaseRuns[LEDGER_ID]?.find((run) => run.id === AGENT_ID)?.status).toBe(
    'running',
  );
  expect(state.agentTurnState[AGENT_ID]).toMatchObject({ kind: 'blocked', runId: RUN_ID });
  expect(stageInfosOf({ state })[LEDGER_ID]?.stage).toBe('attention');
};

describe('store on sqlite: a waiting permission across a reload', () => {
  it('still needs you after the reload, and the card answers it', async () => {
    await useAppStore.getState().hydrate();

    expect(useAppStore.getState().error).toBeNull();
    expect(useAppStore.getState().bootPhase).toBe('ready');
    expect(await savedStatus()).toBe('running');
    const agent = useAppStore
      .getState()
      .sessionPhaseRuns[LEDGER_ID]?.find((run) => run.id === AGENT_ID);
    expect(agent?.status).toBe('running');
    expect(useAppStore.getState().agentTurnState[AGENT_ID]).toMatchObject({
      kind: 'blocked',
      runId: RUN_ID,
    });
    await vi.waitFor(() => {
      expect(useAppStore.getState().transcripts[AGENT_ID]).toContainEqual(
        expect.objectContaining({ kind: 'permission_request', toolUseId: TOOL_USE_ID }),
      );
    });

    await useAppStore.getState().resolvePermissionRequest({
      sessionId: LEDGER_ID,
      agentId: AGENT_ID,
      toolUseId: TOOL_USE_ID,
      toolName: 'Bash',
      runId: RUN_ID,
      scope: 'once',
    });
    flushTurnEvents();

    await vi.waitFor(async () => {
      expect(
        await findUndecidedPermissionAsk({ db: storySqlite(), agentId: AGENT_ID, runId: RUN_ID }),
      ).toBeNull();
    });
  });

  const readAsks = () =>
    openPermissionAsksOf({
      events: useAppStore.getState().transcripts[AGENT_ID] ?? [],
      turnState: useAppStore.getState().agentTurnState[AGENT_ID],
    });

  const hydrateWithAsk = async (): Promise<void> => {
    storySpies.runTurn.mockImplementation(() => endedStream());
    await useAppStore.getState().hydrate();
    await vi.waitFor(() => {
      expect(readAsks().map((ask) => ask.toolUseId)).toEqual([TOOL_USE_ID]);
    });
  };

  it('offers the ask again after a reload, and a message denies it with the text as the reason', async () => {
    await hydrateWithAsk();

    await useAppStore.getState().sendTurn({
      sessionId: LEDGER_ID,
      agentId: AGENT_ID,
      content: 'Do a dry run first',
      origin: 'operator',
    });
    flushTurnEvents();

    const events = useAppStore.getState().transcripts[AGENT_ID] ?? [];
    const decision = events.findIndex((event) => event.kind === 'permission_decision');
    const message = events.findIndex((event) => event.kind === 'user_text');
    expect(events[decision]).toMatchObject({
      decision: 'deny',
      decidedBy: 'user',
      toolUseId: TOOL_USE_ID,
      runId: RUN_ID,
      reason: 'Do a dry run first',
    });
    expect(decision).toBeLessThan(message);
    expect(events[message]).toMatchObject({ text: 'Do a dry run first' });
    expect(readAsks()).toEqual([]);
    expect(JSON.stringify(storySpies.runTurn.mock.calls.at(-1))).toContain(
      'Denied Bash. Do a dry run first',
    );
    await vi.waitFor(async () => {
      expect(
        await findUndecidedPermissionAsk({ db: storySqlite(), agentId: AGENT_ID, runId: RUN_ID }),
      ).toBeNull();
    });
  });

  it('does not deny an ask you allowed while the message waited, and the prompt says so', async () => {
    await hydrateWithAsk();

    await useAppStore.getState().sendTurn({
      sessionId: LEDGER_ID,
      agentId: AGENT_ID,
      content: 'Do a dry run first',
      origin: 'operator',
      onWritingUserText: async () => {
        useAppStore.getState().appendTurnEvent(AGENT_ID, LEDGER_ID, {
          kind: 'permission_decision',
          runId: RUN_ID,
          toolUseId: TOOL_USE_ID,
          decision: 'allow',
          scope: 'once',
          ruleId: null,
          decidedBy: 'user',
          at: STORY_NOW,
        });
      },
    });
    flushTurnEvents();

    const decisions = (useAppStore.getState().transcripts[AGENT_ID] ?? []).filter(
      (event) => event.kind === 'permission_decision',
    );
    expect(decisions).toHaveLength(1);
    expect(decisions[0]).toMatchObject({ decision: 'allow' });
    const prompt = JSON.stringify(storySpies.runTurn.mock.calls.at(-1));
    expect(prompt).toContain('Do a dry run first');
    expect(prompt).not.toContain('Denied Bash');
  });

  it('writes no empty reason for a message that only carries a file', async () => {
    await hydrateWithAsk();

    await useAppStore.getState().sendTurn({
      sessionId: LEDGER_ID,
      agentId: AGENT_ID,
      content: '',
      origin: 'operator',
      storedAttachments: [
        {
          id: 'attachment-ledger',
          kind: 'file',
          fileName: 'ledger.csv',
          mimeType: 'text/csv',
          relPath: '.goodboy/attachments/attachment-ledger/ledger.csv',
        },
      ],
    });
    flushTurnEvents();

    const decision = (useAppStore.getState().transcripts[AGENT_ID] ?? []).find(
      (event) => event.kind === 'permission_decision',
    );
    expect(decision).toMatchObject({ decision: 'deny', toolUseId: TOOL_USE_ID });
    expect(decision).not.toHaveProperty('reason');
    const prompt = JSON.stringify(storySpies.runTurn.mock.calls.at(-1));
    expect(prompt).toContain('Denied Bash for this one call.');
    expect(prompt).toContain('ledger.csv');
  });

  it('keeps an answer you already gave when a message denies the ask that is left', async () => {
    await hydrateWithAsk();
    const later: TurnEvent = {
      kind: 'permission_request',
      runId: RUN_ID,
      toolUseId: 'tool-ledger-seed',
      toolName: 'Edit',
      input: { file_path: 'ledger-core/seed.sql' },
      at: STORY_NOW,
    };
    useAppStore.getState().appendTurnEvent(AGENT_ID, LEDGER_ID, later);
    await useAppStore.getState().allowAndContinue({
      sessionId: LEDGER_ID,
      agentId: AGENT_ID,
      toolUseId: TOOL_USE_ID,
      toolName: 'Bash',
      input: { command: 'pnpm db:migrate' },
      runId: RUN_ID,
    });
    expect(storySpies.runTurn).not.toHaveBeenCalled();
    expect(readAsks().map((ask) => ask.toolUseId)).toEqual(['tool-ledger-seed']);

    await useAppStore.getState().sendTurn({
      sessionId: LEDGER_ID,
      agentId: AGENT_ID,
      content: 'Leave the seed alone',
      origin: 'operator',
    });
    flushTurnEvents();

    const turn = JSON.stringify(storySpies.runTurn.mock.calls.at(-1));
    expect(turn).toContain('Permission for Bash is granted for this one call.');
    expect(turn).toContain('Denied Edit. Leave the seed alone');
    expect(turn).toContain('Bash(pnpm db:migrate)');
  });

  describe('answers that never reached a turn', () => {
    const SECOND_TOOL_USE_ID = 'tool-ledger-seed';
    const saveEvent = async ({
      id,
      event,
    }: {
      readonly id: string;
      readonly event: TurnEvent;
    }): Promise<void> => {
      await insertTurnEvent(storySqlite(), {
        id,
        sessionId: LEDGER_ID,
        agentId: AGENT_ID,
        event,
      });
    };
    const allowedOnce = ({ toolUseId }: { readonly toolUseId: string }): TurnEvent => ({
      kind: 'permission_decision',
      runId: RUN_ID,
      toolUseId,
      decision: 'allow',
      scope: 'once',
      ruleId: null,
      decidedBy: 'user',
      at: STORY_NOW,
    });
    const saveBothAnswers = async (): Promise<void> => {
      await saveEvent({
        id: 'event-ledger-ask-seed',
        event: {
          kind: 'permission_request',
          runId: RUN_ID,
          toolUseId: SECOND_TOOL_USE_ID,
          toolName: 'Edit',
          input: { file_path: 'ledger-core/seed.sql' },
          at: STORY_NOW,
        },
      });
      await saveEvent({
        id: 'event-ledger-allow-migrate',
        event: allowedOnce({ toolUseId: TOOL_USE_ID }),
      });
      await saveEvent({
        id: 'event-ledger-allow-seed',
        event: allowedOnce({ toolUseId: SECOND_TOOL_USE_ID }),
      });
    };

    it('Continue after a reload carries both grants, and the next turn carries none', async () => {
      await saveBothAnswers();
      storySpies.runTurn.mockImplementation(() => endedStream());
      await useAppStore.getState().hydrate();
      await vi.waitFor(() => {
        expect(useAppStore.getState().transcripts[AGENT_ID]).toHaveLength(4);
      });
      expect(useAppStore.getState().agentTurnState[AGENT_ID]?.kind).not.toBe('blocked');

      await useAppStore.getState().continueStoppedAgent({
        sessionId: LEDGER_ID,
        agentId: AGENT_ID,
      });
      flushTurnEvents();

      const turn = JSON.stringify(storySpies.runTurn.mock.calls.at(-1));
      expect(turn).toContain('Permission for Bash is granted for this one call.');
      expect(turn).toContain('Permission for Edit is granted for this one call.');
      expect(turn).toContain('Bash(pnpm db:migrate)');
      expect(turn).toContain('Edit(ledger-core/seed.sql)');

      await useAppStore.getState().sendTurn({
        sessionId: LEDGER_ID,
        agentId: AGENT_ID,
        content: 'Now check the totals',
        origin: 'operator',
      });

      const next = JSON.stringify(storySpies.runTurn.mock.calls.at(-1));
      expect(next).not.toContain('Permission for Bash');
      expect(next).not.toContain('Bash(pnpm db:migrate)');
    });

    it('a turn nobody typed carries them too, and an answered turn does not repeat them', async () => {
      await hydrateWithAsk();
      useAppStore
        .getState()
        .appendTurnEvent(AGENT_ID, LEDGER_ID, allowedOnce({ toolUseId: TOOL_USE_ID }));

      await useAppStore.getState().sendTurn({
        sessionId: LEDGER_ID,
        agentId: AGENT_ID,
        content: 'Run the next step',
        origin: 'workflow',
      });

      const turn = JSON.stringify(storySpies.runTurn.mock.calls.at(-1));
      expect(turn).toContain('Permission for Bash is granted for this one call.');
      expect(turn).toContain('Bash(pnpm db:migrate)');
    });
  });

  it('a window that kept the ask learns another window answered it, and the queue goes on', async () => {
    await hydrateWithAsk();
    await insertTurnEvent(storySqlite(), {
      id: 'event-other-window-allow',
      sessionId: LEDGER_ID,
      agentId: AGENT_ID,
      event: {
        kind: 'permission_decision',
        runId: RUN_ID,
        toolUseId: TOOL_USE_ID,
        decision: 'allow',
        scope: 'once',
        ruleId: null,
        decidedBy: 'user',
        at: STORY_NOW,
      },
    });
    await recordAgentStatus(storySqlite(), AGENT_ID, { status: 'completed' });
    useAppStore.setState({
      agentQueue: {
        [AGENT_ID]: [
          {
            id: 'queued-ledger',
            agentId: AGENT_ID,
            content: 'Then check the totals',
            attachments: [],
            override: undefined,
            status: 'queued',
            createdAt: STORY_NOW,
          },
        ],
      },
    });

    await useAppStore.getState().drainAgentQueue({ sessionId: LEDGER_ID, agentId: AGENT_ID });

    expect(readAsks()).toEqual([]);
    expect(useAppStore.getState().agentTurnState[AGENT_ID]?.kind).not.toBe('blocked');
    expect(JSON.stringify(storySpies.runTurn.mock.calls.at(-1))).toContain('Then check the totals');
  });

  it('keeps the ask open when the message was never written', async () => {
    await hydrateWithAsk();

    await expect(
      useAppStore.getState().sendTurn({
        sessionId: LEDGER_ID,
        agentId: AGENT_ID,
        content: 'Do a dry run first',
        origin: 'operator',
        onWritingUserText: async () => {
          throw new Error('The queue could not be saved.');
        },
      }),
    ).rejects.toThrow('The queue could not be saved.');

    const events = useAppStore.getState().transcripts[AGENT_ID] ?? [];
    expect(events.some((event) => event.kind === 'permission_decision')).toBe(false);
  });

  it('leaves the ask alone for a turn nobody typed', async () => {
    await hydrateWithAsk();

    await useAppStore.getState().sendTurn({
      sessionId: LEDGER_ID,
      agentId: AGENT_ID,
      content: 'Run the next step',
      origin: 'workflow',
    });
    flushTurnEvents();

    const events = useAppStore.getState().transcripts[AGENT_ID] ?? [];
    expect(events.some((event) => event.kind === 'permission_decision')).toBe(false);
  });

  it('survives leaving the workspace, the return and a reload, and the card still answers', async () => {
    await useAppStore.getState().hydrate();
    await expectStillWaiting();

    await useAppStore.getState().setCurrentWorkspace(NORTHWIND_ID);
    expect(useAppStore.getState().currentWorkspaceId).toBe(NORTHWIND_ID);
    expect(storySpies.cancelTurn).not.toHaveBeenCalled();
    expect(cancelledRunIds.has(RUN_ID)).toBe(false);
    expect(await savedStatus()).toBe('running');

    await useAppStore.getState().setCurrentWorkspace(HARBORLINE_ID);
    expect(useAppStore.getState().currentWorkspaceId).toBe(HARBORLINE_ID);
    expect(useAppStore.getState().boardReady).toBe(true);
    await expectStillWaiting();

    await resetStoryStore();
    prepareReload();
    await useAppStore.getState().hydrate();
    expect(useAppStore.getState().bootPhase).toBe('ready');
    await expectStillWaiting();
    expect(storySpies.cancelTurn).not.toHaveBeenCalled();

    await useAppStore.getState().resolvePermissionRequest({
      sessionId: LEDGER_ID,
      agentId: AGENT_ID,
      toolUseId: TOOL_USE_ID,
      toolName: 'Bash',
      runId: RUN_ID,
      scope: 'once',
    });
    flushTurnEvents();

    await vi.waitFor(async () => {
      expect(
        await findUndecidedPermissionAsk({ db: storySqlite(), agentId: AGENT_ID, runId: RUN_ID }),
      ).toBeNull();
    });
  });
});
