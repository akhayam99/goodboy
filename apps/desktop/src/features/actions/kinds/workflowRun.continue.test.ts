// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type AgentId } from '@goodboy/types';
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
  runFixture,
  seedActionState,
  sessionFixture,
  stepAgent,
  workflowFixture,
} from '../../../__tests__/helpers/actionFixtures';
import { runObjectAction } from '../registry';
import type { ActionEnv, ObjectTarget } from '../types';

const STOPPED = brandId<AgentId>({ value: 'agent-plan-stopped' });
const RUN_KEY = 'workflow-run:continue';

let useAppStore: StoryStore;

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
      agents: [stepAgent({ id: STOPPED, stepId: STEP_PLAN, status: 'stopped' })],
    },
  });
});

const env: ActionEnv = {
  getState: () => useAppStore.getState(),
  showToast: () => undefined,
  copyText: async () => undefined,
  origin: 'menu',
  anchorKey: null,
  viewing: null,
};

const runPage: ObjectTarget = { kind: 'workflowRun', sessionId: SESSION, runId: RUN };

const pressContinue = () =>
  useAppStore.getState().runAction({
    key: RUN_KEY,
    actionId: 'workflowRun.continue',
    choice: null,
    task: async () => {
      await runObjectAction({ target: runPage, actionId: 'workflowRun.continue', env });
      return null;
    },
  });

describe('Continue on a run with a stopped step', () => {
  it('stays busy until the step answers and refuses a second press', async () => {
    let finish: () => void = () => undefined;
    const continueStoppedAgent = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    useAppStore.setState({ continueStoppedAgent });

    const first = pressContinue();
    await vi.waitFor(() => expect(continueStoppedAgent).toHaveBeenCalledTimes(1));
    expect(useAppStore.getState().actionRuns[RUN_KEY]?.phase).toBe('pending');
    expect(await pressContinue()).toBe('busy');

    finish();
    expect(await first).toBe('applied');
    expect(useAppStore.getState().actionRuns[RUN_KEY]).toBeUndefined();
    expect(continueStoppedAgent).toHaveBeenCalledWith({ sessionId: SESSION, agentId: STOPPED });
  });

  it('hands a failure to the run line instead of dropping it', async () => {
    useAppStore.setState({
      continueStoppedAgent: vi.fn(async () => {
        throw new Error('The provider refused the turn');
      }),
    });
    useAppStore.getState().attachActionRunSurface({ key: RUN_KEY });

    await pressContinue();

    const run = useAppStore.getState().actionRuns[RUN_KEY];
    expect(run?.phase).toBe('failed');
    expect(run?.message).toBe('The provider refused the turn');
  });
});
