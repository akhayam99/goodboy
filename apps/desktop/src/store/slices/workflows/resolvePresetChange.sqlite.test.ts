// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).sqliteDbLibModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  attachWorkflowToSession,
  getSessionById,
  insertSession,
  insertWorkspace,
  updateWorkflowRunOrchestrationStop,
} from '@goodboy/db';
import {
  brandId,
  DEFAULT_WORKFLOW_RULES,
  type IsoDateTime,
  type PlanChangeRequest,
  type WorkflowId,
  type WorkflowOrchestrationStop,
  type WorkflowRules,
  type WorkflowRunId,
  type WorkspaceId,
} from '@goodboy/types';
import { aSession, aWorkflowRun } from '@goodboy/types/testing';
import {
  buildStoryWorkspace,
  importStore,
  injectDbFault,
  openStorySqlite,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  storySqlite,
  type StoryStore,
} from '../../storyHarness';

type StoryState = ReturnType<StoryStore['getState']>;

const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'workspace-cascadia' });
const WORKFLOW_ID = brandId<WorkflowId>({ value: 'workflow-cascadia-layout' });
const RUN_ID = brandId<WorkflowRunId>({ value: 'run-cascadia-layout' });
const NOW = brandId<IsoDateTime>({ value: '2026-10-22T09:00:00.000Z' });
const SESSION = aSession({ workspaceId: WORKSPACE_ID, goal: 'Member pages in ledger-core' });

const ADDED: PlanChangeRequest = {
  kind: 'added',
  step: 'Fix the billing table',
  reason: 'The billing table scrolls sideways at 390px',
};

const STOP: WorkflowOrchestrationStop = {
  kind: 'preset-change',
  message: 'Auto wants to add a step',
};

const RULES: WorkflowRules = {
  ...DEFAULT_WORKFLOW_RULES,
  route: {
    shape: 'plan',
    row: 2,
    presetName: 'Fix a layout',
    closeness: 'follow',
    role: null,
    choice: 'Plan from Fix a layout, 1 step · Follow the preset',
    why: 'Your ask matches the preset',
  },
  preset: {
    workflowId: 'workflow-layout',
    name: 'Fix a layout',
    steps: [
      {
        name: 'Find',
        role: 'scout',
        promptPrefix: 'Find the widths.',
        isPinned: false,
        routingLock: null,
      },
    ],
  },
  pendingChange: ADDED,
};

let useAppStore: StoryStore;
let orchestrateNextStep: ReturnType<typeof vi.fn<StoryState['orchestrateNextStep']>>;

const storedRun = async () =>
  (await getSessionById(storySqlite(), SESSION.id))?.workflowRuns.find((run) => run.id === RUN_ID);

const runNow = () =>
  useAppStore
    .getState()
    .sessions.find((candidate) => candidate.id === SESSION.id)
    ?.workflowRuns.find((run) => run.id === RUN_ID);

const answer = () => useAppStore.getState().resolvePresetChange(SESSION.id, RUN_ID, 'apply');

const expectQuestionKept = async () => {
  const stored = await storedRun();
  expect(stored?.orchestrationStop?.kind).toBe('preset-change');
  expect(stored?.rulesSnapshot?.pendingChange).toMatchObject(ADDED);
  expect(stored?.rulesSnapshot?.approvedChange).toBeUndefined();
  expect(runNow()?.orchestrationStop?.kind).toBe('preset-change');
  expect(runNow()?.rulesSnapshot?.pendingChange).toMatchObject(ADDED);
  expect(orchestrateNextStep).not.toHaveBeenCalled();
};

const expectAnswered = async () => {
  const stored = await storedRun();
  expect(stored?.orchestrationStop).toBeUndefined();
  expect(stored?.rulesSnapshot?.pendingChange).toBeUndefined();
  expect(stored?.rulesSnapshot?.approvedChange).toMatchObject(ADDED);
  expect(stored?.orchestratorHints?.map((hint) => hint.text)).toHaveLength(1);
  expect(runNow()?.orchestrationStop).toBeUndefined();
  expect(runNow()?.rulesSnapshot?.approvedChange).toMatchObject(ADDED);
  expect(orchestrateNextStep).toHaveBeenCalledTimes(1);
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  const db = await openStorySqlite();
  await insertWorkspace({
    db,
    workspace: buildStoryWorkspace({ id: WORKSPACE_ID, name: 'Cascadia' }),
  });
  await insertSession(db, SESSION);
  await db.execute(
    'INSERT INTO workflows (id, workspace_id, name, created_at, updated_at) VALUES (?, ?, ?, 1, 1)',
    [WORKFLOW_ID, WORKSPACE_ID, 'Plan from Fix a layout'],
  );
  await attachWorkflowToSession({
    db,
    sessionId: SESSION.id,
    workflowRunId: RUN_ID,
    workflowId: WORKFLOW_ID,
    autoRun: true,
    updatedAt: NOW,
    executionMode: 'dynamic',
    rulesSnapshot: RULES,
  });
  await updateWorkflowRunOrchestrationStop(db, RUN_ID, STOP);
  const run = aWorkflowRun({
    id: RUN_ID,
    workflowId: WORKFLOW_ID,
    executionMode: 'dynamic',
    orchestrationStop: STOP,
    rulesSnapshot: RULES,
  });
  orchestrateNextStep = vi.fn<StoryState['orchestrateNextStep']>(async () => undefined);
  useAppStore.setState({ sessions: [{ ...SESSION, workflowRuns: [run] }], orchestrateNextStep });
});

describe('resolvePresetChange', () => {
  it('saves the answer and lifts the stop together, then asks Auto again', async () => {
    expect(await answer()).toBe(true);

    await expectAnswered();
  });

  it('keeps the question when the hint cannot be saved, and a retry answers it', async () => {
    injectDbFault({ match: /SET orchestrator_hint_log/, message: 'database is locked' });

    await expect(answer()).rejects.toThrow('database is locked');
    await expectQuestionKept();

    expect(await answer()).toBe(true);
    await expectAnswered();
  });

  it('keeps the question when the answer and the stop cannot be saved, and a retry answers it once', async () => {
    injectDbFault({ match: /orchestration_stop_kind/, message: 'database is locked' });

    await expect(answer()).rejects.toThrow('database is locked');
    await expectQuestionKept();

    expect(await answer()).toBe(true);
    await expectAnswered();
  });

  it('does nothing when another window answered between the read and the save', async () => {
    await useAppStore.getState().updateWorkflowRunRules(SESSION.id, RUN_ID, (rules) => ({
      ...rules,
      pendingChange: undefined,
    }));
    const stale = aWorkflowRun({
      id: RUN_ID,
      workflowId: WORKFLOW_ID,
      executionMode: 'dynamic',
      orchestrationStop: STOP,
      rulesSnapshot: RULES,
    });
    useAppStore.setState({ sessions: [{ ...SESSION, workflowRuns: [stale] }] });

    expect(await answer()).toBe(false);

    expect(orchestrateNextStep).not.toHaveBeenCalled();
    expect((await storedRun())?.orchestrationStop?.kind).toBe('preset-change');
  });
});
