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
  storySpies,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { sceneInvoke } from '../../../../../test/sceneInvoke';
import { STORY_COMMENT, STORY_PLAN } from '../../scenes/story/storyContent';
import { storyPlanBodyOf } from '../../scenes/story/storyPlan';
import {
  STORY_PLAN_ID,
  STORY_ROOT_ID,
  STORY_SESSION_ID,
  seedStoryWorld,
} from '../../scenes/story/storyWorld';
import { IMPLEMENTER_ID, TESTER_ID } from '../../scenes/u24/autoSceneSeed';
import { applyStoryAnswer } from './applyStoryAnswer';
import { installStoryPlan } from './installStoryPlan';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command, args) =>
    sceneInvoke({ command: String(command), args }),
  );
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  seedStoryWorld({ stage: 'asking' });
  applyStoryAnswer();
  installStoryPlan({ store });
});

afterEach(() => {
  vi.useRealTimers();
});

const planOf = () => (store.getState().sessionPlans[STORY_SESSION_ID] ?? [])[0];

const commentsOf = () => store.getState().artifactComments[STORY_SESSION_ID] ?? [];

const sendComment = async () => {
  const plan = planOf();
  if (plan === undefined) {
    throw new Error('no plan');
  }
  const id = await store.getState().addArtifactComment({
    sessionId: STORY_SESSION_ID,
    artifactId: STORY_PLAN_ID,
    revision: 1,
    anchor: { kind: 'block', order: 4, text: STORY_PLAN.replayParagraph },
    body: STORY_COMMENT,
  });
  expect(id).not.toBeNull();
  await store.getState().sendArtifactComments({ sessionId: STORY_SESSION_ID, plan });
};

describe('sending the plan comment to the planner', () => {
  it('starts from plan v1 without the simultaneous retries test', () => {
    expect(planOf()?.bodyMd).toBe(storyPlanBodyOf({ revision: 1 }));
    expect(planOf()?.bodyMd).not.toContain('concurrent retries');
  });

  it('keeps the comment a draft until the planner has answered', async () => {
    await sendComment();
    expect(commentsOf().map((comment) => comment.status)).toEqual(['sent']);
    vi.advanceTimersByTime(1000);
    expect(planOf()?.bodyMd).toBe(storyPlanBodyOf({ revision: 1 }));
  });

  it('writes a plan v2 that adds the concurrent retries test and marks the comment Addressed', async () => {
    await sendComment();
    vi.advanceTimersByTime(8000);
    expect(planOf()?.bodyMd).toBe(storyPlanBodyOf({ revision: 2 }));
    expect(planOf()?.bodyMd).toContain(STORY_PLAN.concurrentParagraph);
    const stored = (store.getState().sessionArtifacts[STORY_SESSION_ID] ?? [])[0];
    expect(stored?.revision).toBe(2);
    expect(commentsOf().map((comment) => comment.status)).toEqual(['addressed']);
    const row = (store.getState().autoTreeViews[STORY_SESSION_ID] ?? [])[0]?.artifacts[0];
    expect(row?.revision).toBe(2);
  });
});

describe('approving the revised plan', () => {
  const approve = async () => {
    await sendComment();
    vi.advanceTimersByTime(8000);
    await store.getState().sendTurn({
      sessionId: STORY_SESSION_ID,
      agentId: STORY_ROOT_ID,
      content: 'Approved plan v2.',
    });
  };

  it('coordinates a Codex implementer in payments-api and a tester against ledger-core', async () => {
    await approve();
    vi.advanceTimersByTime(30000);
    const delegations = (store.getState().autoTreeViews[STORY_SESSION_ID] ?? []).flatMap(
      (view) => view.delegations,
    );
    const implementer = delegations.find((entry) => entry.childAgentId === IMPLEMENTER_ID);
    const tester = delegations.find((entry) => entry.childAgentId === TESTER_ID);
    expect(implementer).toMatchObject({ state: 'settled', target: { mountName: 'payments-api' } });
    expect(implementer?.routing.provider).toBe('codex');
    expect(tester).toMatchObject({ state: 'settled', target: { mountName: 'ledger-core' } });
    expect(delegations.filter((entry) => entry.role === 'implementer')).toHaveLength(1);
  });

  it('leaves ledger-core untouched and never opens a pull request', async () => {
    await approve();
    vi.advanceTimersByTime(30000);
    const delegations = (store.getState().autoTreeViews[STORY_SESSION_ID] ?? []).flatMap(
      (view) => view.delegations,
    );
    const tester = delegations.find((entry) => entry.childAgentId === TESTER_ID);
    expect(JSON.stringify(tester?.result)).not.toContain('src/postings');
    const events = store.getState().sessionEvents[STORY_SESSION_ID] ?? [];
    expect(events.some((event) => event.kind === 'pr_created')).toBe(false);
    expect(store.getState().sessionGithub[STORY_SESSION_ID]?.pr ?? null).toBeNull();
  });
});
