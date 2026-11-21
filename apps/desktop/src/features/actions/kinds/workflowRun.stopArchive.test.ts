// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../store/storyHarness';
import {
  RUN,
  SESSION,
  STEP_PLAN,
  seedActionState,
  runFixture,
  sessionFixture,
  stepAgent,
  workflowFixture,
} from '../../../__tests__/helpers/actionFixtures';
import { brandId, type AgentId, type WorkflowRunId } from '@goodboy/types';
import type { ShowToastParams } from '../../../shared/components/Toast/toastContext';
import { bindTarget, runObjectAction } from '../registry';
import type { ActionEnv, ObjectTarget } from '../types';

const STEP = brandId<AgentId>({ value: 'agent-ledger-core-step' });

let useAppStore: StoryStore;
let toasts: Array<ShowToastParams>;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({
    db_select: [],
    db_execute: 1,
    db_transaction: { status: 'committed', results: [] },
  });
  seedActionState({
    useAppStore,
    seed: {
      session: sessionFixture({ workflowRuns: [runFixture()] }),
      workflows: [workflowFixture()],
      agents: [stepAgent({ id: STEP, stepId: STEP_PLAN, status: 'running' })],
    },
  });
  useAppStore.setState({ currentSessionId: SESSION });
  toasts = [];
});

const env = (): ActionEnv => ({
  getState: () => useAppStore.getState(),
  showToast: (toast) => {
    toasts.push(toast);
  },
  copyText: async () => undefined,
  origin: 'menu',
  anchorKey: null,
  viewing: null,
});

const runPage: ObjectTarget = { kind: 'workflowRun', sessionId: SESSION, runId: RUN };

const resolved = (id: string) =>
  bindTarget({ state: useAppStore.getState(), target: runPage })
    ?.resolve()
    .find((action) => action.id === id);

describe('Stop run on the run page', () => {
  it('asks nothing and stops the run at once', async () => {
    const stopWorkflowRunNow = vi.fn(async () => 'stopped' as const);
    useAppStore.setState({ stopWorkflowRunNow });

    expect(resolved('workflowRun.close')?.confirm).toBeNull();
    await runObjectAction({
      target: runPage,
      actionId: 'workflowRun.close',
      env: env(),
      choice: null,
    });

    expect(stopWorkflowRunNow).toHaveBeenCalledWith(SESSION, RUN);
  });

  it('says Continue in the toast and continues the step that was running', async () => {
    const continueStoppedAgent = vi.fn(async () => undefined);
    useAppStore.setState({
      stopWorkflowRunNow: vi.fn(async () => 'stopped' as const),
      continueStoppedAgent,
    });

    await runObjectAction({
      target: runPage,
      actionId: 'workflowRun.close',
      env: env(),
      choice: null,
    });
    await toasts[0]?.action?.undo?.();

    expect(toasts[0]?.message).toBe('Run stopped');
    expect(toasts[0]?.action?.label).toBe('Continue');
    expect(continueStoppedAgent).toHaveBeenCalledWith({ sessionId: SESSION, agentId: STEP });
  });
});

describe('Archive run on the run page', () => {
  const seedAgent = ({ status }: { readonly status: 'running' | 'completed' }) =>
    seedActionState({
      useAppStore,
      seed: {
        session: sessionFixture({ workflowRuns: [runFixture()] }),
        workflows: [workflowFixture()],
        agents: [stepAgent({ id: STEP, stepId: STEP_PLAN, status })],
      },
    });

  beforeEach(() => {
    seedAgent({ status: 'completed' });
    useAppStore.setState({ currentSessionId: SESSION });
  });

  it('keeps the confirmation while a step is running, because Undo cannot restart it', () => {
    seedAgent({ status: 'running' });
    useAppStore.setState({ currentSessionId: SESSION });

    expect(resolved('workflowRun.discard')?.confirm?.title).toBe('Archive this run?');
  });

  it('keeps the confirmation when a run is chained after it', () => {
    seedActionState({
      useAppStore,
      seed: {
        session: sessionFixture({
          workflowRuns: [
            runFixture(),
            runFixture({
              id: brandId<WorkflowRunId>({ value: 'run-chained-northwind' }),
              chainAfterId: RUN,
              triggerMode: 'after_run',
            }),
          ],
        }),
        workflows: [workflowFixture()],
        agents: [stepAgent({ id: STEP, stepId: STEP_PLAN, status: 'completed' })],
      },
    });
    useAppStore.setState({ currentSessionId: SESSION });

    expect(resolved('workflowRun.discard')?.confirm?.title).toBe('Archive this run?');
  });

  it('asks nothing and archives at once', async () => {
    const discardWorkflow = vi.fn(async () => undefined);
    useAppStore.setState({ discardWorkflow });

    expect(resolved('workflowRun.discard')?.confirm).toBeNull();
    await runObjectAction({
      target: runPage,
      actionId: 'workflowRun.discard',
      env: env(),
      choice: null,
    });

    expect(discardWorkflow).toHaveBeenCalledWith(SESSION, RUN);
  });

  it('restores the run when the toast says Undo', async () => {
    const restoreWorkflow = vi.fn(async () => undefined);
    useAppStore.setState({ discardWorkflow: vi.fn(async () => undefined), restoreWorkflow });

    await runObjectAction({
      target: runPage,
      actionId: 'workflowRun.discard',
      env: env(),
      choice: null,
    });
    expect(toasts[0]?.action?.label).toBe('Undo');
    await toasts[0]?.action?.undo?.();

    expect(restoreWorkflow).toHaveBeenCalledWith(SESSION, RUN);
  });

  it('offers no Undo when the archive failed', async () => {
    useAppStore.setState({
      discardWorkflow: vi.fn(async () => {
        throw new Error('The database is locked');
      }),
    });

    await runObjectAction({
      target: runPage,
      actionId: 'workflowRun.discard',
      env: env(),
      choice: null,
    }).catch(() => undefined);

    expect(toasts.filter((toast) => toast.action?.label === 'Undo')).toEqual([]);
  });
});
