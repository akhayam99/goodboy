// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, type RenderResult } from '@testing-library/react';
import { ToastProvider } from '../../shared/components/Toast';
import { OrchestratedRunPage } from '../../features/session/components/OrchestratedRun';
import { insertWorkspace, saveWorkflow } from '@goodboy/db';
import { ORCHESTRATOR_SYSTEM_PROMPT } from '@goodboy/core';
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
vi.mock('../../features/skills/skills', async () =>
  (await import('../../store/storyHarness')).skillsModuleMock(),
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
const WORKFLOW_ID = brandedId<WorkflowId>({ value: 'workflow-settlement-run' });
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
let replies: Array<string>;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  requests = [];
  replies = [SCOUT_STEP, REVIEW_STEP, DONE];
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

const runOf = (workflowRunId: WorkflowRunId) =>
  useAppStore
    .getState()
    .sessions.find((candidate) => candidate.id === sessionId)
    ?.workflowRuns.find((candidate) => candidate.id === workflowRunId);

const runIdOfSession = (): WorkflowRunId => {
  const run = useAppStore.getState().sessions.find((entry) => entry.id === sessionId)
    ?.workflowRuns[0];
  if (run === undefined) {
    throw new Error('the run was not attached');
  }
  return run.id;
};

const runAgents = async (workflowRunId: WorkflowRunId) =>
  rowsOf<{ name: string; status: string }>({
    sql: 'SELECT name, status FROM agents WHERE workflow_run_id = ? ORDER BY ordinal',
    params: [workflowRunId],
  });

type ShowParams = {
  readonly view: RenderResult;
  readonly workflowRunId: WorkflowRunId;
};

const showPage = ({ view, workflowRunId }: ShowParams): string => {
  const session = useAppStore.getState().sessions.find((entry) => entry.id === sessionId);
  const run = runOf(workflowRunId);
  const workflow = useAppStore.getState().phaseTemplates[WORKSPACE_ID]?.[0];
  if (session === undefined || run === undefined || workflow === undefined) {
    throw new Error('the run page has nothing to show');
  }
  view.rerender(
    <ToastProvider>
      <OrchestratedRunPage session={session} run={run} workflow={workflow} />
    </ToastProvider>,
  );
  return view.container.textContent ?? '';
};

const storedOutcome = async (workflowRunId: WorkflowRunId) =>
  rowsOf<{ orchestration_outcome: string | null }>({
    sql: 'SELECT orchestration_outcome FROM session_workflows WHERE workflow_run_id = ?',
    params: [workflowRunId],
  });

describe('journey: an orchestrated run to completion', () => {
  it('decides a step, runs it, decides the next, and finishes when the orchestrator says done', async () => {
    await useAppStore.getState().attachWorkflowToSession(sessionId, WORKFLOW_ID, {
      autoRun: true,
      executionMode: 'dynamic',
      triggerMode: 'immediate',
    });
    const workflowRunId = runIdOfSession();
    expect(runOf(workflowRunId)?.executionMode).toBe('dynamic');
    const view = render(<ToastProvider>{null}</ToastProvider>);

    await vi.waitFor(() => expect(held.turns).toHaveLength(1));
    expect(requests).toHaveLength(1);
    expect(await runAgents(workflowRunId)).toEqual([
      { name: 'Scout the settlement code', status: 'running' },
    ]);
    const first = showPage({ view, workflowRunId });
    expect(first).toContain('Scout the settlement code');
    expect(first).toContain('Step 1 is running');
    expect(first).toContain('Why this step');
    expect(first).not.toContain('Run complete');
    expect(runOf(workflowRunId)?.orchestrationOutcome).toBeUndefined();

    held.turns[0]?.finish();

    await vi.waitFor(() => expect(held.turns).toHaveLength(2));
    expect(requests).toHaveLength(2);
    expect(await runAgents(workflowRunId)).toEqual([
      { name: 'Scout the settlement code', status: 'completed' },
      { name: 'Review the settlement map', status: 'running' },
    ]);
    expect(runOf(workflowRunId)?.orchestrationOutcome).toBeUndefined();
    const second = showPage({ view, workflowRunId });
    expect(second).toContain('Review the settlement map');
    expect(second).toContain('Step 2 is running');
    expect(second).toContain('Why this step');
    expect(second).not.toContain('Run complete');

    held.turns[1]?.finish();

    await vi.waitFor(() => expect(runOf(workflowRunId)?.orchestrationOutcome).toBe('done'));
    expect(requests).toHaveLength(3);
    expect(await runAgents(workflowRunId)).toEqual([
      { name: 'Scout the settlement code', status: 'completed' },
      { name: 'Review the settlement map', status: 'completed' },
    ]);
    expect(await storedOutcome(workflowRunId)).toEqual([{ orchestration_outcome: 'done' }]);
    expect(runOf(workflowRunId)?.orchestrationStop).toBeUndefined();
    expect(useAppStore.getState().orchestratingWorkflowRuns[workflowRunId]).toBe(false);
    expect(held.turns).toHaveLength(2);
    const finished = showPage({ view, workflowRunId });
    expect(finished).toContain('Run complete');
    expect(finished).toContain('The settlement flow is mapped and reviewed.');
    expect(finished).not.toContain('is running');
  });
});
