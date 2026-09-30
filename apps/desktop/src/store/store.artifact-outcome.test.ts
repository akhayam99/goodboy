import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  AgentStatus,
  IsoDateTime,
  SessionArtifact,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import {
  assistantTurnStream,
  buildStoryAgent,
  buildStorySession,
  buildStoryWorkspace,
  connectedAnthropicState,
  resetStorySpies,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  type StoryStore,
} from './storyHarness';
import { agentStateWord } from '../features/session/agentStateWord';
import { isAgentMissingArtifact } from '../features/artifacts/turnArtifactOutcome';
import { buildTimelineGroups } from '../features/session/timeline/buildTimelineGroups';
import { resolveAgentRowState } from '../features/workTreeModel/rowState';
import { rowStateNode, rowStateTone } from '../features/workTreeModel/rowStateCopy';

const artifactStore = vi.hoisted(() => ({ rows: [] as Array<unknown> }));

vi.mock('@tauri-apps/api/core', async () => (await import('./storyHarness')).tauriCoreModuleMock());
vi.mock('@tauri-apps/api/event', async () =>
  (await import('./storyHarness')).tauriEventModuleMock(),
);
vi.mock('../shared/lib/db', async () => (await import('./storyHarness')).dbLibModuleMock());
vi.mock('@goodboy/db', async () => (await import('./storyHarness')).dbModuleMock());
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
vi.mock('../features/skills/skills', async () =>
  (await import('./storyHarness')).skillsModuleMock(),
);
vi.mock('../features/workflows/workflows', async () =>
  (await import('./storyHarness')).workflowsModuleMock(),
);
vi.mock('../features/worktree/worktree', async () =>
  (await import('./storyHarness')).worktreeModuleMock(),
);
vi.mock('../shared/lib/repo', async () => (await import('./storyHarness')).repoModuleMock());
vi.mock('../features/plans/plans', async () => (await import('./storyHarness')).plansModuleMock());
vi.mock('../features/artifacts/artifacts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../features/artifacts/artifacts')>();
  return {
    ...actual,
    listArtifactsForSession: vi.fn(async () => artifactStore.rows),
    createArtifact: vi.fn(async (input: Record<string, unknown>) => {
      const row = { ...input, id: `artifact-${artifactStore.rows.length + 1}`, status: 'active' };
      artifactStore.rows.push(row);
      return row;
    }),
  };
});

const NOW = '2026-09-27T00:00:00.000Z' as IsoDateTime;
const SESSION_ID = 'session-report' as SessionId;
const WORKSPACE_ID = 'workspace-report' as WorkspaceId;
const AGENT_ID = 'agent-report' as AgentId;

const BROKEN_REPORT = [
  'Here is the report.',
  '<<artifact v=1 kind=report>>',
  'title: Harborline weekly',
  '<</artifact>>',
].join('\n');

const CAPTURED_REPORT = [
  '<<artifact v=1 kind=report>>',
  JSON.stringify({ title: 'Harborline weekly', format: 'markdown' }),
  '## Week',
  'The "settle" job ran clean.',
  '<</artifact>>',
].join('\n');

let useAppStore: StoryStore;
let row: Agent;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const agentRow = (): Agent | undefined =>
  (useAppStore.getState().sessionPhaseRuns[SESSION_ID] ?? []).find(
    (agent) => agent.id === AGENT_ID,
  );

const artifacts = (): ReadonlyArray<SessionArtifact> =>
  useAppStore.getState().sessionArtifacts[SESSION_ID] ?? [];

const runReportTurn = async (text: string): Promise<void> => {
  storySpies.runTurn.mockImplementation(assistantTurnStream(text));
  await useAppStore
    .getState()
    .sendTurn({ sessionId: SESSION_ID, agentId: AGENT_ID, content: 'write the weekly report' });
};

const timelineRowState = () => {
  const entry = buildTimelineGroups({
    sessionId: SESSION_ID,
    agents: useAppStore.getState().sessionPhaseRuns[SESSION_ID] ?? [],
    workflows: [],
    plans: [],
    artifacts: artifacts(),
    externalTasks: [],
    questions: [],
    worktrees: [],
    events: [],
    agentKindOverride: {},
  }).entries.find((candidate) => candidate.kind === 'agent');
  if (entry?.kind !== 'agent') {
    throw new Error('no agent entry');
  }
  return resolveAgentRowState({
    agent: entry.agent,
    isAsking: false,
    question: null,
    isReadyStep: false,
    isMissingArtifact: entry.isMissingArtifact,
  });
};

const stateWord = () => {
  const agent = agentRow();
  if (agent === undefined) {
    throw new Error('no agent row');
  }
  return agentStateWord({
    agent,
    hasOpenQuestion: false,
    isTurnLive: false,
    hasActiveChild: false,
    isMissingArtifact: isAgentMissingArtifact({ agent, kind: 'report', artifacts: artifacts() }),
  });
};

describe('artifact outcome through the real store', () => {
  beforeEach(() => {
    resetStorySpies();
    artifactStore.rows = [];
    row = buildStoryAgent({ id: AGENT_ID, sessionId: SESSION_ID, name: 'weekly report' });
    row = { ...row, kind: 'report' };
    storySpies.invokeAgentList.mockImplementation(async () => [row] as never);
    storySpies.invokeAgentUpdateStatus.mockImplementation(
      async (_id: AgentId, fields: { readonly status: AgentStatus }) => {
        row = { ...row, status: fields.status };
        return row as never;
      },
    );
    useAppStore.setState({
      sessions: [
        buildStorySession({
          id: SESSION_ID,
          workspaceId: WORKSPACE_ID,
          goal: 'weekly report',
          state: { kind: 'idle', lastActivityAt: NOW },
        }),
      ],
      projects: [],
      sessionPhaseRuns: { [SESSION_ID]: [row] },
      sessionArtifacts: { [SESSION_ID]: [] },
      transcripts: {},
      selectedAgentId: { [SESSION_ID]: AGENT_ID },
      agentKindOverride: { [AGENT_ID]: 'report' },
      notifications: [],
      notificationCounts: [],
      workspaces: [buildStoryWorkspace({ id: WORKSPACE_ID, name: 'ws', slug: 'ws' })],
      ...connectedAnthropicState(),
    });
  });

  it('shows no green anywhere when the report block could not be captured', async () => {
    await runReportTurn(BROKEN_REPORT);

    await vi.waitFor(() => expect(agentRow()?.status).toBe('blocked'));
    expect(artifacts()).toEqual([]);
    const rowState = timelineRowState();
    expect(rowState.reason).toEqual({ kind: 'noArtifact' });
    expect(rowStateNode({ state: rowState })).toEqual({ state: 'approval', label: 'No artifact' });
    expect(rowStateTone({ state: rowState })).toBe('warning');
    expect(stateWord()).toEqual({ word: 'No artifact', tone: 'warning', group: 'needs-you' });
    const events = useAppStore.getState().transcripts[AGENT_ID] ?? [];
    expect(events.some((event) => event.kind === 'artifact_capture_failed')).toBe(true);
  });

  it('flags a report turn that ended with no block at all', async () => {
    await runReportTurn('I read the evidence and the week looks fine.');

    await vi.waitFor(() => expect(agentRow()?.status).toBe('blocked'));
    const events = useAppStore.getState().transcripts[AGENT_ID] ?? [];
    expect(events).toContainEqual(
      expect.objectContaining({ kind: 'artifact_capture_failed', code: 'missing' }),
    );
    expect(stateWord().word).toBe('No artifact');
  });

  it('goes green once the artifact is captured', async () => {
    await runReportTurn(CAPTURED_REPORT);

    await vi.waitFor(() => expect(agentRow()?.status).toBe('completed'));
    await vi.waitFor(() => expect(artifacts()).toHaveLength(1));
    expect(timelineRowState().phase).toBe('done');
    expect(stateWord()).toEqual({ word: 'Done', tone: 'success', group: 'done' });
    const events = useAppStore.getState().transcripts[AGENT_ID] ?? [];
    expect(events.some((event) => event.kind === 'artifact_capture_failed')).toBe(false);
  });

  it('shows no green when a parsed report fails to save', async () => {
    const { createArtifact } = await import('../features/artifacts/artifacts');
    vi.mocked(createArtifact).mockRejectedValueOnce(new Error('disk full'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await runReportTurn(CAPTURED_REPORT);

    await vi.waitFor(() => expect(agentRow()?.status).toBe('blocked'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[artifact-capture] failed'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('disk full'));
    warn.mockRestore();
    expect(artifacts()).toEqual([]);
    expect(stateWord().word).toBe('No artifact');
    const events = useAppStore.getState().transcripts[AGENT_ID] ?? [];
    expect(events.some((event) => event.kind === 'artifact_capture_failed')).toBe(true);
  });
});
