// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type AgentId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import { bindTarget, runObjectAction } from '../../features/actions/registry';
import type { ActionEnv, ObjectTarget } from '../../features/actions/types';
import {
  AGENT,
  SESSION,
  STEP_BUILD,
  STEP_PLAN,
  mountFixture,
  seedActionState,
  stepAgent,
  type ActionSeed,
} from '../helpers/actionFixtures';
import { RUNNING } from '../helpers/agentMenuStates';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

const env: ActionEnv = {
  getState: () => useAppStore.getState(),
  showToast: () => undefined,
  copyText: async () => undefined,
  origin: 'menu',
  anchorKey: null,
  viewing: null,
};

const SESSION_TARGET: ObjectTarget = { kind: 'session', sessionId: SESSION };

const OTHER = brandId<AgentId>({ value: 'agent-reviewer-northwind' });

const RUNNING_STATES: ReadonlyArray<readonly [string, ActionSeed, ReadonlyArray<AgentId>]> = [
  [
    'a step that is running',
    {
      agents: [stepAgent({ id: AGENT, stepId: STEP_BUILD, status: 'running' })],
      turnStates: { [AGENT]: RUNNING },
    },
    [AGENT],
  ],
  [
    'a step marked running before its turn started',
    { agents: [stepAgent({ id: AGENT, stepId: STEP_BUILD, status: 'running' })] },
    [AGENT],
  ],
  [
    'a step with a live turn after it was marked blocked',
    {
      agents: [stepAgent({ id: AGENT, stepId: STEP_BUILD, status: 'blocked' })],
      turnStates: { [AGENT]: RUNNING },
    },
    [AGENT],
  ],
  [
    'two steps running at once',
    {
      agents: [
        stepAgent({ id: AGENT, stepId: STEP_PLAN, status: 'running' }),
        stepAgent({ id: OTHER, stepId: STEP_BUILD, status: 'running' }),
      ],
      turnStates: { [AGENT]: RUNNING, [OTHER]: RUNNING },
    },
    [AGENT, OTHER],
  ],
];

describe('Stop all running agents keeps a stop for every running state of a run', () => {
  it.each(RUNNING_STATES)('stops %s from the session menu', async (_name, value, stopped) => {
    seedActionState({
      useAppStore,
      seed: { ...value, mounts: [mountFixture()], branch: 'hl/payout-export' },
    });
    const stoppedIds: Array<AgentId> = [];
    useAppStore.setState({
      cancelTurnConfirmed: async ({ agentId }) => {
        stoppedIds.push(agentId);
        return { outcome: 'exited', exitedAt: null };
      },
    });
    const ids = (
      bindTarget({ state: useAppStore.getState(), target: SESSION_TARGET })?.resolve() ?? []
    ).map((action) => action.id);
    expect(ids).toContain('session.stopAll');

    await runObjectAction({
      target: SESSION_TARGET,
      actionId: 'session.stopAll',
      env,
      choice: null,
    });

    expect([...stoppedIds].sort()).toEqual([...stopped].sort());
  });
});
