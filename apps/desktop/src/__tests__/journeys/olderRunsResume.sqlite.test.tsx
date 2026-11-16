// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../shared/components/Toast';
import { WorkflowsPane } from '../../features/session/components/SessionWorkspace/parts/WorkflowsPane';
import { insertWorkspace, saveWorkflow } from '@goodboy/db';
import { ORCHESTRATOR_SYSTEM_PROMPT } from '@goodboy/core/orchestrator';
import type {
  IsoDateTime,
  SessionId,
  Workflow,
  WorkflowId,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import { brandedId } from '../../features/history/testing/brandedId';
import {
  bindAgentRowsToSqlite,
  createHeldTurns,
  stubProviderRouting,
  type HeldTurns,
} from '../helpers/journeyHarness';
import { summarizerQueues } from '../../store/slices/turn/turnHelpers';
import {
  buildStoryWorkspace,
  connectedAnthropicState,
  importStore,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  STORE_IMPORT_TIMEOUT_MS,
  storySqlite,
  STORY_NOW,
  storySpies,
  stubStoryInvoke,
  type StoryStore,
} from '../../store/storyHarness';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../shared/lib/db', async () =>
  (await import('../../store/storyHarness')).sqliteDbLibModuleMock(),
);
vi.mock('../../features/chat/turn', async () =>
  (await import('../../store/storyHarness')).turnModuleMock(),
);
vi.mock('../../features/permissions/permissions', async () =>
  (await import('../../store/storyHarness')).permissionsModuleMock(),
);
vi.mock('../../features/providers/providers', async () =>
  (await import('../../store/storyHarness')).providersModuleMock(),
);
vi.mock('../../features/providers/routing', async () =>
  (await import('../../store/storyHarness')).routingModuleMock(),
);
vi.mock('../../features/budget/budget', async () =>
  (await import('../../store/storyHarness')).budgetModuleMock(),
);
vi.mock('../../features/workflows/workflows', async () =>
  (await import('../../store/storyHarness')).workflowsModuleMock(),
);
vi.mock('../../features/worktree/worktree', async () =>
  (await import('../../store/storyHarness')).worktreeModuleMock(),
);
vi.mock('../../shared/lib/repo', async () =>
  (await import('../../store/storyHarness')).repoModuleMock(),
);
vi.mock('../../features/plans/plans', async () =>
  (await import('../../store/storyHarness')).plansModuleMock(),
);

const WORKSPACE_ID = brandedId<WorkspaceId>({ value: 'workspace-harborline' });
const WORKFLOW_ID = brandedId<WorkflowId>({ value: 'workflow-older-settlement-run' });
const AT = brandedId<IsoDateTime>({ value: '2026-10-16T09:00:00.000Z' });

const harborline = buildStoryWorkspace({
  id: WORKSPACE_ID,
  name: 'Harborline',
  slug: 'harborline',
});

const template: Workflow = {
  id: WORKFLOW_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Orchestrated workflow',
  description: '',
  steps: [],
  origin: 'orchestrated',
  createdAt: STORY_NOW,
  updatedAt: STORY_NOW,
};

type AuxPayload = {
  readonly args: { readonly systemPrompt: string; readonly prompt?: string };
};

const decisionReply = (text: string) => ({
  stdout: JSON.stringify({
    type: 'result',
    subtype: 'success',
    is_error: false,
    result: text,
    usage: { input_tokens: 1200, output_tokens: 240 },
  }),
  stderr: '',
  exitCode: 0,
});

const orchestrated = (decision: Readonly<Record<string, unknown>>): string =>
  ['<<orchestrator>>', JSON.stringify(decision), '<</orchestrator>>'].join('\n');

const SCOUT_STEP = orchestrated({
  action: 'next',
  reason: 'The settlement code has not been mapped yet.',
  step: {
    name: 'Scout the settlement code',
    role: 'scout',
    promptPrefix: 'Map how ledger-core settles a payment from payments-api.',
  },
});

const REVIEW_STEP = orchestrated({
  action: 'next',
  reason: 'The map needs a second read before anyone changes it.',
  step: {
    name: 'Review the settlement map',
    role: 'reviewer',
    promptPrefix: 'Review the settlement map for gaps in ledger-core.',
  },
});

const DONE = orchestrated({
  action: 'done',
  reason: 'The settlement flow is mapped and reviewed.',
});

let useAppStore: StoryStore;
let sessionId: SessionId;
let held: HeldTurns;
let requests: Array<AuxPayload>;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  requests = [];
  const replies = [SCOUT_STEP, REVIEW_STEP, DONE];
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace: harborline });
  await db.execute(
    'INSERT INTO workflows (id, workspace_id, name, created_at, updated_at) VALUES (?, ?, ?, 1, 1)',
    [WORKFLOW_ID, WORKSPACE_ID, template.name],
  );
  useAppStore.setState({
    workspaces: [harborline],
    currentWorkspaceId: WORKSPACE_ID,
    projects: [],
    sessions: [],
    archivedSessions: {},
    phaseTemplates: { [WORKSPACE_ID]: [template] },
    ...connectedAnthropicState(),
  });
  await stubProviderRouting();
  storySpies.scratchDirPrepare.mockResolvedValue('/tmp/goodboy-root/scratch/harborline');
  stubStoryInvoke({
    workspaces_with_unread: [],
    gh_run: { stdout: '', stderr: 'no git remotes found', exitCode: 1 },
    planner_run: (payload: AuxPayload) => {
      if (payload.args.systemPrompt !== ORCHESTRATOR_SYSTEM_PROMPT) {
        return { stdout: '', stderr: 'no aux provider in tests', exitCode: 1 };
      }
      requests.push(payload);
      return decisionReply(replies[requests.length - 1] ?? DONE);
    },
  });
  storySpies.invokeWorkflowUpsert.mockImplementation((args) => saveWorkflow(storySqlite(), args));
  bindAgentRowsToSqlite();
  held = createHeldTurns({ at: AT, opening: 'Reading the settlement code.' });
  const { session } = await useAppStore.getState().createSession({
    workspaceId: WORKSPACE_ID,
    goal: 'Map how ledger-core settles a payment from payments-api',
  });
  sessionId = session.id;
});

afterEach(async () => {
  cleanup();
  useAppStore.setState({ summarizerStatus: {} });
  await vi.waitFor(() => {
    held.finishAll();
    expect(Object.values(useAppStore.getState().orchestratingWorkflowRuns)).not.toContain(true);
    expect(summarizerQueues.size).toBe(0);
  });
});

const sessionOf = () => {
  const session = useAppStore.getState().sessions.find((entry) => entry.id === sessionId);
  if (session === undefined) {
    throw new Error('the session is gone');
  }
  return session;
};

const runOf = (workflowRunId: WorkflowRunId) =>
  sessionOf().workflowRuns.find((candidate) => candidate.id === workflowRunId);

const runAgents = async (workflowRunId: WorkflowRunId) =>
  rowsOf<{ name: string; status: string }>({
    sql: 'SELECT name, status FROM agents WHERE workflow_run_id = ? ORDER BY ordinal',
    params: [workflowRunId],
  });

const leadTrees = async () =>
  rowsOf<{ id: string }>({ sql: 'SELECT id FROM auto_trees', params: [] });

const olderRunHalfway = async (): Promise<WorkflowRunId> => {
  await useAppStore.getState().attachWorkflowToSession(sessionId, WORKFLOW_ID, {
    autoRun: true,
    executionMode: 'dynamic',
    triggerMode: 'immediate',
  });
  const workflowRunId = sessionOf().workflowRuns[0]?.id;
  if (workflowRunId === undefined) {
    throw new Error('the run was not attached');
  }
  await vi.waitFor(() => expect(held.turns).toHaveLength(1));
  held.turns[0]?.finish();
  await vi.waitFor(() => expect(held.turns).toHaveLength(2));
  expect(await useAppStore.getState().stopWorkflowRunNow(sessionId, workflowRunId)).toBe('stopped');
  await vi.waitFor(() =>
    expect(useAppStore.getState().orchestratingWorkflowRuns[workflowRunId]).not.toBe(true),
  );
  return workflowRunId;
};

const rowOfRun = (): HTMLElement => {
  const grid = screen.getByRole('list', { name: 'Runs' });
  const row = within(grid)
    .getAllByRole('listitem')
    .find((item) => (item.textContent ?? '').includes('Workflow · Orchestrated'));
  if (row === undefined) {
    throw new Error('the older run has no row');
  }
  return row;
};

describe('journey: an orchestrated run left open before the upgrade', () => {
  it('keeps its row, then Continue finishes it on its own engine with no Lead', async () => {
    const workflowRunId = await olderRunHalfway();
    expect(runOf(workflowRunId)?.executionMode).toBe('dynamic');
    expect(runOf(workflowRunId)?.orchestrationStop?.kind).toBe('operator');
    expect(requests).toHaveLength(2);

    render(
      <ToastProvider>
        <WorkflowsPane session={sessionOf()} />
      </ToastProvider>,
    );
    await act(async () => undefined);

    const row = rowOfRun();
    expect(row.textContent).toContain('older run');
    expect(row.textContent).toContain('Stopped');
    fireEvent.click(within(row).getByRole('button', { name: 'Continue' }));

    await vi.waitFor(() => expect(held.turns).toHaveLength(3));
    held.turns[2]?.finish();

    await vi.waitFor(() => expect(runOf(workflowRunId)?.orchestrationOutcome).toBe('done'));
    expect(requests).toHaveLength(3);
    expect(
      requests.every((request) => request.args.systemPrompt === ORCHESTRATOR_SYSTEM_PROMPT),
    ).toBe(true);
    expect(await runAgents(workflowRunId)).toEqual([
      { name: 'Scout the settlement code', status: 'completed' },
      { name: 'Review the settlement map', status: 'completed' },
    ]);
    expect(await leadTrees()).toEqual([]);
  });

  it('continues once when Continue is pressed twice', async () => {
    const workflowRunId = await olderRunHalfway();
    render(
      <ToastProvider>
        <WorkflowsPane session={sessionOf()} />
      </ToastProvider>,
    );
    await act(async () => undefined);

    const button = within(rowOfRun()).getByRole('button', { name: 'Continue' });
    fireEvent.click(button);
    fireEvent.click(button);

    await vi.waitFor(() => expect(held.turns).toHaveLength(3));
    held.turns[2]?.finish();
    await vi.waitFor(() => expect(runOf(workflowRunId)?.orchestrationOutcome).toBe('done'));
    expect(held.turns).toHaveLength(3);
  });
});
