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
import { STORY_QUESTION } from '../../scenes/story/storyContent';
import { STORY_PLANNER_ID, STORY_SESSION_ID, seedStoryWorld } from '../../scenes/story/storyWorld';
import { installStoryDirection } from './installStoryDirection';

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
  seedStoryWorld({ stage: 'draft' });
  installStoryDirection({ store });
});

afterEach(() => {
  vi.useRealTimers();
});

const startSession = async () => {
  const workspaceId = store.getState().currentWorkspaceId;
  if (workspaceId === null) {
    throw new Error('no workspace');
  }
  return store.getState().startSessionFromDraft({
    workspaceId,
    start: { kind: 'workflow-run', goal: 'Fix HBL-412', run: async () => undefined },
  });
};

const plannerEvents = () => store.getState().transcripts[STORY_PLANNER_ID] ?? [];

describe('starting the story workflow', () => {
  it('opens one session linked to HBL-412 where the planner waits on the repeat question', async () => {
    const session = await startSession();
    expect(session.id).toBe(STORY_SESSION_ID);
    expect(store.getState().currentSessionId).toBe(STORY_SESSION_ID);
    expect(
      (store.getState().sessionExternalTasks[STORY_SESSION_ID] ?? []).map(
        (task) => task.identifier,
      ),
    ).toEqual(['HBL-412']);
    const asked = store.getState().sessionOpenQuestions[STORY_SESSION_ID] ?? [];
    expect(asked).toHaveLength(1);
    expect(asked[0]).toMatchObject({
      text: STORY_QUESTION.text,
      isBlocking: true,
      status: 'open',
      createdByAgentId: STORY_PLANNER_ID,
    });
  });
});

describe('answering the planner question', () => {
  const answer = async () => {
    await startSession();
    const [question] = store.getState().sessionOpenQuestions[STORY_SESSION_ID] ?? [];
    if (question === undefined) {
      throw new Error('no question');
    }
    await store
      .getState()
      .answerOpenQuestions(
        STORY_SESSION_ID,
        [{ id: question.id, text: question.text, answer: STORY_QUESTION.recommended }],
        STORY_PLANNER_ID,
      );
  };

  it('moves the planner from Claude to Codex when Claude is at its limit', async () => {
    await answer();
    expect(plannerEvents().some((event) => event.kind === 'decision_note')).toBe(false);
    vi.advanceTimersByTime(1600);
    expect(plannerEvents().some((event) => event.kind === 'decision_note')).toBe(true);
    const planner = (store.getState().sessionPhaseRuns[STORY_SESSION_ID] ?? []).find(
      (agent) => agent.id === STORY_PLANNER_ID,
    );
    expect(planner?.providerOverride).toBe('codex');
    expect(store.getState().sessionPlans[STORY_SESSION_ID] ?? []).toHaveLength(0);
  });

  it('lets Codex finish the same task and return the plan with the answer kept', async () => {
    await answer();
    vi.advanceTimersByTime(15000);
    expect(store.getState().agentTurnState[STORY_PLANNER_ID]?.kind).toBe('idle');
    const plans = store.getState().sessionPlans[STORY_SESSION_ID] ?? [];
    expect(plans).toHaveLength(1);
    expect(plans[0]?.bodyMd).toContain('replay test');
    expect(store.getState().sessionOpenQuestions[STORY_SESSION_ID] ?? []).toHaveLength(0);
    const answered = store.getState().sessionAnsweredQuestions[STORY_SESSION_ID] ?? [];
    expect(answered[0]?.userAnswer).toBe(STORY_QUESTION.recommended);
    const sent = plannerEvents().find(
      (event) => event.kind === 'user_text' && event.text.includes(STORY_QUESTION.recommended),
    );
    expect(sent).toBeDefined();
  });
});
