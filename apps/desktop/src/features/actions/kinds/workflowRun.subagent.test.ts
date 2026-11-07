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
  type StoryStore,
} from '../../../store/storyHarness';
import {
  RUN,
  SESSION,
  STEP_PLAN,
  agentFixture,
  runFixture,
  seedActionState,
  sessionFixture,
  stepAgent,
  workflowFixture,
} from '../../../__tests__/helpers/actionFixtures';
import { bindTarget, runObjectAction } from '../registry';
import type { ActionEnv, ObjectTarget } from '../types';

const ROOT = brandId<AgentId>({ value: 'agent-plan' });
const HELPER = brandId<AgentId>({ value: 'agent-plan-helper' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  seedActionState({
    useAppStore,
    seed: {
      session: sessionFixture({ workflowRuns: [runFixture()] }),
      workflows: [workflowFixture()],
      agents: [
        stepAgent({ id: ROOT, stepId: STEP_PLAN, status: 'running' }),
        agentFixture({
          id: HELPER,
          name: 'Read the ledger',
          parentAgentId: ROOT,
          workflowRunId: RUN,
          status: 'running',
        }),
      ],
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

const helperPage: ObjectTarget = {
  kind: 'workflowRun',
  sessionId: SESSION,
  runId: RUN,
  stepAgentId: HELPER,
};

describe('the step verbs on the page of a subagent', () => {
  it('opens the transcript of the subagent, not of its step', async () => {
    await runObjectAction({
      target: helperPage,
      actionId: 'workflowRun.stepTranscript',
      env,
      choice: null,
    });

    expect(useAppStore.getState().drawer).toMatchObject({
      kind: 'transcript',
      payload: { agentId: HELPER },
    });
  });

  it('keeps Skip step on the step the subagent belongs to', async () => {
    const skipStuckStepAndAdvance = vi.fn(async () => undefined);
    useAppStore.setState({ skipStuckStepAndAdvance });
    const skip = bindTarget({ state: useAppStore.getState(), target: helperPage })
      ?.resolve()
      .find((action) => action.id === 'workflowRun.skipStep');

    expect(skip?.label).toBe('Skip step 1');
    await runObjectAction({
      target: helperPage,
      actionId: 'workflowRun.skipStep',
      env,
      choice: null,
    });

    expect(skipStuckStepAndAdvance).toHaveBeenCalledWith(SESSION, RUN, {
      force: true,
      agentId: ROOT,
    });
  });
});
