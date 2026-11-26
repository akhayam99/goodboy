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
import { STORY_COMMENT, STORY_PLAN, STORY_REVIEW } from '../../scenes/story/storyContent';
import type { AgentId } from '@goodboy/types';
import { AUTO_STORY } from './autoStory';
import { demoRuns } from './demoRunRegistry';
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
  demoRuns.cancelAll();
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
    vi.advanceTimersByTime(3500);
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
    vi.advanceTimersByTime(3500);
    await store.getState().sendTurn({
      sessionId: STORY_SESSION_ID,
      agentId: STORY_ROOT_ID,
      content: 'Approved plan v2.',
    });
  };

  const agentNames = (): ReadonlyArray<string> =>
    (store.getState().sessionPhaseRuns[STORY_SESSION_ID] ?? []).map((agent) => agent.name);

  const eventsOf = ({ agentId }: { readonly agentId: AgentId }) =>
    store.getState().transcripts[agentId] ?? [];

  const turnOf = ({ agentId }: { readonly agentId: AgentId }) =>
    store.getState().agentTurnState[agentId]?.kind;

  const delegationOf = ({ agentId }: { readonly agentId: AgentId }) =>
    (store.getState().autoTreeViews[STORY_SESSION_ID] ?? [])
      .flatMap((view) => view.delegations)
      .find((entry) => entry.childAgentId === agentId);

  const textOf = ({ agentId }: { readonly agentId: AgentId }): string =>
    eventsOf({ agentId })
      .flatMap((event) => (event.kind === 'assistant_text' ? [event.delta] : []))
      .join('');

  const countOf = ({ agentId, kind }: { readonly agentId: AgentId; readonly kind: string }) =>
    eventsOf({ agentId }).filter((event) => event.kind === kind).length;

  type MilestoneParams = {
    readonly isReached: () => boolean;
    readonly limitMs?: number;
  };

  let elapsed = 0;

  const reach = ({ isReached, limitMs = 14000 }: MilestoneParams): number => {
    while (!isReached() && elapsed < limitMs) {
      vi.advanceTimersByTime(50);
      elapsed += 50;
    }
    expect(isReached()).toBe(true);
    return elapsed;
  };

  it('grows the tree one agent at a time and shows what each one does before the summary', async () => {
    await approve();
    elapsed = 0;
    expect(agentNames()).toEqual(['Lead', 'Planner']);
    expect(turnOf({ agentId: STORY_ROOT_ID })).toBe('running');
    expect(textOf({ agentId: STORY_ROOT_ID }).includes(AUTO_STORY.third)).toBe(false);
    const leadWrote = reach({
      isReached: () => textOf({ agentId: STORY_ROOT_ID }).includes(AUTO_STORY.third),
    });
    expect(agentNames()).toEqual(['Lead', 'Planner']);

    const selected = () => store.getState().selectedAgentId[STORY_SESSION_ID];
    expect(selected()).toBe(STORY_ROOT_ID);
    const implementerStarted = reach({ isReached: () => agentNames().includes('Implementer') });
    expect(selected()).toBe(IMPLEMENTER_ID);
    expect(agentNames()).not.toContain('Tester');
    expect(turnOf({ agentId: IMPLEMENTER_ID })).toBe('running');
    expect(eventsOf({ agentId: IMPLEMENTER_ID }).map((event) => event.kind)).toEqual(['user_text']);
    expect(delegationOf({ agentId: IMPLEMENTER_ID })?.state).toBe('running');
    const implementerSpoke = reach({
      isReached: () => textOf({ agentId: IMPLEMENTER_ID }).length > 0,
    });
    const implementerRead = reach({
      isReached: () => countOf({ agentId: IMPLEMENTER_ID, kind: 'tool_call_end' }) === 1,
    });
    const implementerEdited = reach({
      isReached: () => countOf({ agentId: IMPLEMENTER_ID, kind: 'file_edit' }) === 2,
    });
    expect(delegationOf({ agentId: IMPLEMENTER_ID })?.state).toBe('running');
    const implementerDone = reach({
      isReached: () => delegationOf({ agentId: IMPLEMENTER_ID })?.state === 'settled',
    });
    expect(agentNames()).not.toContain('Tester');

    expect(JSON.stringify(delegationOf({ agentId: IMPLEMENTER_ID })?.result)).not.toContain(
      'connection reset',
    );
    const testerStarted = reach({ isReached: () => agentNames().includes('Tester') });
    expect(selected()).toBe(TESTER_ID);
    expect(turnOf({ agentId: TESTER_ID })).toBe('running');
    expect(eventsOf({ agentId: TESTER_ID }).map((event) => event.kind)).toEqual(['user_text']);
    expect(delegationOf({ agentId: IMPLEMENTER_ID })?.state).toBe('settled');
    const testerRan = reach({
      isReached: () => countOf({ agentId: TESTER_ID, kind: 'tool_call_end' }) === 1,
    });
    expect(
      eventsOf({ agentId: TESTER_ID }).find((event) => event.kind === 'tool_call_end'),
    ).toMatchObject({ output: STORY_REVIEW.testOutput });
    expect(textOf({ agentId: STORY_ROOT_ID }).includes(AUTO_STORY.final)).toBe(false);
    const testerDone = reach({
      isReached: () => delegationOf({ agentId: TESTER_ID })?.state === 'settled',
    });
    expect(turnOf({ agentId: STORY_ROOT_ID })).toBe('running');
    expect(selected()).toBe(TESTER_ID);
    const leadSummarized = reach({
      isReached: () => textOf({ agentId: STORY_ROOT_ID }).includes(AUTO_STORY.final),
    });
    expect(turnOf({ agentId: STORY_ROOT_ID })).toBe('running');
    expect(selected()).toBe(STORY_ROOT_ID);
    const finished = reach({ isReached: () => turnOf({ agentId: STORY_ROOT_ID }) === 'idle' });

    expect([
      leadWrote,
      implementerStarted,
      implementerSpoke,
      implementerRead,
      implementerEdited,
      implementerDone,
      testerStarted,
      testerRan,
      testerDone,
      leadSummarized,
      finished,
    ]).toEqual(
      [
        ...[
          leadWrote,
          implementerStarted,
          implementerSpoke,
          implementerRead,
          implementerEdited,
          implementerDone,
          testerStarted,
          testerRan,
          testerDone,
          leadSummarized,
          finished,
        ],
      ].sort((left, right) => left - right),
    );
    expect(implementerStarted - leadWrote).toBeLessThanOrEqual(800);
    expect(finished).toBeLessThanOrEqual(11000);
    expect(agentNames()).toEqual(['Lead', 'Planner', 'Implementer', 'Tester']);
  });

  it('coordinates a Codex implementer in payments-api and a tester against ledger-core', async () => {
    await approve();
    vi.advanceTimersByTime(12000);
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

  it('ends the Auto turn only after both agents read Done and the Lead summarized', async () => {
    await approve();
    const isSettled = (): boolean =>
      (store.getState().autoTreeViews[STORY_SESSION_ID] ?? [])
        .flatMap((view) => view.delegations)
        .filter((entry) => entry.state === 'settled' && entry.role !== 'planner').length === 2;
    let elapsed = 0;
    while (!isSettled() && elapsed < 12000) {
      vi.advanceTimersByTime(100);
      elapsed += 100;
    }
    expect(isSettled()).toBe(true);
    expect(store.getState().agentTurnState[STORY_ROOT_ID]?.kind).not.toBe('idle');
    vi.advanceTimersByTime(2500);
    expect(store.getState().agentTurnState[STORY_ROOT_ID]?.kind).toBe('idle');
  });

  it('leaves ledger-core untouched and never opens a pull request', async () => {
    await approve();
    vi.advanceTimersByTime(12000);
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
