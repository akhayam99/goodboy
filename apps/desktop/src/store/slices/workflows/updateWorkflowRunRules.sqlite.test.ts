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
  getWorkflowRunRulesText,
  insertSession,
  insertWorkspace,
  updateWorkflowRunRulesSnapshot,
} from '@goodboy/db';
import {
  brandId,
  DEFAULT_WORKFLOW_RULES,
  parseWorkflowRulesText,
  type IsoDateTime,
  type RunRoute,
  type WorkflowId,
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
import { tauriDatabase } from '../../../shared/lib/db';

const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'workspace-northwind' });
const WORKFLOW_ID = brandId<WorkflowId>({ value: 'workflow-northwind-billing' });
const RUN_ID = brandId<WorkflowRunId>({ value: 'run-northwind-billing' });
const NOW = brandId<IsoDateTime>({ value: '2026-10-22T09:00:00.000Z' });
const SESSION = aSession({ workspaceId: WORKSPACE_ID, goal: 'Billing pages in payments-api' });

const ROUTE: RunRoute = {
  shape: 'plan',
  row: 2,
  presetName: 'Fix a layout',
  closeness: 'follow',
  role: null,
  choice: 'Plan from Fix a layout · Follow the preset',
  why: 'Your ask matches the preset',
  ask: 'Fix the billing table',
};

const RULES: WorkflowRules = { ...DEFAULT_WORKFLOW_RULES, route: ROUTE };

let useAppStore: StoryStore;

const storedRules = async () =>
  parseWorkflowRulesText({
    text: (await getWorkflowRunRulesText({ db: storySqlite(), workflowRunId: RUN_ID }))?.text,
  });

const stateRules = () =>
  useAppStore
    .getState()
    .sessions.find((candidate) => candidate.id === SESSION.id)
    ?.workflowRuns.find((run) => run.id === RUN_ID)?.rulesSnapshot;

const toAdapt = (rules: WorkflowRules): WorkflowRules =>
  rules.route === undefined ? rules : { ...rules, route: { ...rules.route, closeness: 'adapt' } };

const withChange = (rules: WorkflowRules): WorkflowRules => ({
  ...rules,
  planChanges: [
    ...(rules.planChanges ?? []),
    { kind: 'added', step: 'Check the totals', reason: 'Totals drift', agentId: null },
  ],
});

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  const db = await openStorySqlite();
  await insertWorkspace({
    db,
    workspace: buildStoryWorkspace({ id: WORKSPACE_ID, name: 'Northwind' }),
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
  const run = aWorkflowRun({
    id: RUN_ID,
    workflowId: WORKFLOW_ID,
    executionMode: 'dynamic',
    rulesSnapshot: RULES,
  });
  useAppStore.setState({ sessions: [{ ...SESSION, workflowRuns: [run] }] });
});

describe('updateWorkflowRunRules', () => {
  it('keeps both of two updates started together on one run', async () => {
    const update = useAppStore.getState().updateWorkflowRunRules;

    await Promise.all([
      update(SESSION.id, RUN_ID, toAdapt),
      update(SESSION.id, RUN_ID, withChange),
    ]);

    const stored = await storedRules();
    expect(stored?.route?.closeness).toBe('adapt');
    expect(stored?.planChanges?.map((change) => change.step)).toEqual(['Check the totals']);
    expect(stateRules()?.route?.closeness).toBe('adapt');
    expect(stateRules()?.planChanges).toHaveLength(1);
  });

  it('applies the patch on top of a change another window saved meanwhile', async () => {
    const select = tauriDatabase.select.bind(tauriDatabase);
    let hasRaced = false;
    const spy = vi.spyOn(tauriDatabase, 'select').mockImplementation(async (sql, params) => {
      const rows = await select(sql, params);
      if (!hasRaced && sql.startsWith('SELECT rules_snapshot')) {
        hasRaced = true;
        await updateWorkflowRunRulesSnapshot({
          db: storySqlite(),
          workflowRunId: RUN_ID,
          rulesSnapshot: withChange(RULES),
        });
      }
      return rows;
    });
    let calls = 0;

    await useAppStore.getState().updateWorkflowRunRules(SESSION.id, RUN_ID, (rules) => {
      calls += 1;
      return toAdapt(rules);
    });
    spy.mockRestore();

    const stored = await storedRules();
    expect(calls).toBe(2);
    expect(stored?.route?.closeness).toBe('adapt');
    expect(stored?.planChanges).toHaveLength(1);
    expect(stateRules()?.planChanges).toHaveLength(1);
  });

  it('keeps the old rules on screen when the write fails', async () => {
    injectDbFault({
      match: /UPDATE session_workflows SET rules_snapshot/,
      message: 'database is locked',
    });

    await expect(
      useAppStore.getState().updateWorkflowRunRules(SESSION.id, RUN_ID, toAdapt),
    ).rejects.toThrow('database is locked');

    expect(stateRules()?.route?.closeness).toBe('follow');
    expect((await storedRules())?.route?.closeness).toBe('follow');
  });
});
