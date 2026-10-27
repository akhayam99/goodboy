// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { seedC07 } from '../../scenes/u25/c07/c07AutoSeed';
import { AUTO_ROOT_ID, AUTO_SESSION, IMPLEMENTER_ID } from '../../scenes/u24/autoSceneSeed';
import { autoTimeline } from './autoTimeline';
import { createSimulatedSend } from './createSimulatedSend';
import { createReplyRuns } from './createReplyRuns';
import { nowIso } from '../../../../../store/slices/project-mounts/nowIso';
import { currentTreeStopPort } from '../../../../../features/auto/treeStopPort';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ db_select: [], db_execute: { rowsAffected: 0 } });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
});

afterEach(() => {
  vi.useRealTimers();
});

type SeedParams = {
  readonly state: 'working' | 'plan';
  readonly place: 'auto' | 'start';
};

const install = ({ state, place }: SeedParams) => {
  seedC07({ state, place });
  store.setState({
    sendTurn: createSimulatedSend({
      store,
      reply: 'On it.',
      now: () => nowIso({}),
      shouldClearDraft: true,
      runs: createReplyRuns(),
    }),
  });
  const timeline = autoTimeline({ state: store.getState() });
  if (timeline === null) {
    throw new Error('no Auto timeline');
  }
  timeline.setup?.({ store });
  return timeline;
};

const phaseOf = (): string | undefined =>
  store.getState().autoTreeViews[AUTO_SESSION.id]?.[0]?.tree.phase;

describe('the simulated Auto start', () => {
  it('starts Auto, streams its reply and only then shows a plan to approve', async () => {
    install({ state: 'working', place: 'start' });
    await store.getState().spawnAgent(AUTO_SESSION.id, {
      kindOverride: 'auto',
      initialPrompt: 'Check ledger-core for the same duplicate event risk.',
    });
    const started = store.getState();
    expect(started.transcripts[AUTO_ROOT_ID]?.[0]).toMatchObject({
      kind: 'user_text',
      text: 'Check ledger-core for the same duplicate event risk.',
    });
    expect(started.agentTurnState[AUTO_ROOT_ID]?.kind).toBe('running');
    expect(started.sessionPlans[AUTO_SESSION.id]).toEqual([]);
    vi.advanceTimersByTime(20000);
    const planned = store.getState();
    expect(planned.sessionPlans[AUTO_SESSION.id]?.length).toBe(1);
    expect(planned.agentTurnState[AUTO_ROOT_ID]?.kind).toBe('idle');
    expect(phaseOf()).toBe('waiting');
  });
});

describe('the simulated Auto approval', () => {
  it('starts the helpers on approval and settles them once', async () => {
    install({ state: 'plan', place: 'auto' });
    await store.getState().sendTurn({
      sessionId: AUTO_SESSION.id,
      agentId: AUTO_ROOT_ID,
      content: 'Approved plan v1.',
    });
    vi.advanceTimersByTime(100);
    expect(store.getState().agentTurnState[IMPLEMENTER_ID]?.kind).toBe('running');
    vi.advanceTimersByTime(30000);
    expect(phaseOf()).toBe('done');
    expect(store.getState().agentTurnState[AUTO_ROOT_ID]?.kind).toBe('idle');
    const approvals = (store.getState().transcripts[AUTO_ROOT_ID] ?? []).filter(
      (event) => event.kind === 'user_text' && event.text === 'Approved plan v1.',
    );
    expect(approvals).toHaveLength(1);
  });

  it('leaves other messages to the simulated send', async () => {
    install({ state: 'plan', place: 'auto' });
    await store.getState().sendTurn({
      sessionId: AUTO_SESSION.id,
      agentId: AUTO_ROOT_ID,
      content: 'Why two packages?',
    });
    vi.advanceTimersByTime(30000);
    expect(phaseOf()).toBe('waiting');
  });
});

describe('stopping Auto in the demo', () => {
  it('stops the helpers once and leaves nothing running', async () => {
    install({ state: 'plan', place: 'auto' });
    await store.getState().sendTurn({
      sessionId: AUTO_SESSION.id,
      agentId: AUTO_ROOT_ID,
      content: 'Approved plan v1.',
    });
    vi.advanceTimersByTime(1500);
    const port = currentTreeStopPort();
    if (port === null) {
      throw new Error('no stop port');
    }
    await expect(port({ treeId: 'demo-tree' })).resolves.toBe('stopped');
    expect(store.getState().agentTurnState[IMPLEMENTER_ID]?.kind).toBe('idle');
    expect(store.getState().agentTurnState[AUTO_ROOT_ID]?.kind).toBe('idle');
    vi.advanceTimersByTime(30000);
    expect(phaseOf()).toBe('stopped');
    const implementer = store
      .getState()
      .sessionPhaseRuns[AUTO_SESSION.id]?.find((agent) => agent.id === IMPLEMENTER_ID);
    expect(implementer).toMatchObject({ status: 'stopped', stoppedBy: 'you' });
    const running = store
      .getState()
      .autoTreeViews[AUTO_SESSION.id]?.[0]?.delegations.filter(
        (entry) => entry.state === 'running',
      );
    expect(running).toEqual([]);
  });
});
